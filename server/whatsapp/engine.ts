// Rule engine: matches CRM events to active rules, evaluates whitelisted
// conditions (no eval/Function - see shared/schema.ts CONDITION_OPERATORS),
// starts/advances automation runs, and computes message-job scheduling.
// This module never talks to the QuickAuth API directly - that's worker.ts.

import { storage } from "../storage";
import { automationEvents, AUTOMATION_EVENT, type AutomationEventPayload } from "./events";
import {
  TRIGGER_DEFINITIONS,
  STOP_CONDITION_LABELS,
  type WhatsappAutomationRuleDetail,
  type WhatsappAutomationCondition,
  type WhatsappAutomationStep,
  type ConditionOperator,
  type WhatsappEntityType,
  type Lead,
  type Patient,
  type Appointment,
  type StopConditionType,
  type WhatsappAutomationRun,
  type DelayUnit,
} from "@shared/schema";

const CLINIC_NAME = "Nobel Mulani Hair Transplant & Cosmetic-Aesthetic Center";
const CLINIC_ADDRESS = process.env.CLINIC_ADDRESS || "";

export interface EntityContext {
  type: WhatsappEntityType;
  id: string;
  lead?: Lead;
  patient?: Patient;
  appointment?: Appointment;
}

export async function loadEntity(entityType: WhatsappEntityType, entityId: string): Promise<EntityContext | undefined> {
  if (entityType === "lead") {
    const lead = await storage.getLead(entityId);
    return lead ? { type: "lead", id: entityId, lead } : undefined;
  }
  if (entityType === "patient") {
    const patient = await storage.getPatient(entityId);
    return patient ? { type: "patient", id: entityId, patient } : undefined;
  }
  if (entityType === "appointment") {
    const appointment = await storage.getAppointment(entityId);
    if (!appointment) return undefined;
    const patient = appointment.patientId ? await storage.getPatient(appointment.patientId) : undefined;
    return { type: "appointment", id: entityId, appointment, patient };
  }
  return undefined;
}

// ---- Condition evaluation (whitelisted fields/operators only) ----

function resolveFieldValue(ctx: EntityContext, field: string): string | undefined {
  switch (field) {
    case "source": return ctx.lead?.source ?? ctx.patient?.source;
    case "status": return ctx.lead?.status ?? ctx.patient?.status ?? ctx.appointment?.status;
    case "notes": return ctx.lead?.notes;
    case "phone": return ctx.lead?.phone ?? ctx.patient?.phone;
    case "createdAt": return ctx.lead?.createdAt;
    case "department": return ctx.patient?.department;
    case "registrationDate": return ctx.patient?.registrationDate;
    case "dob": return ctx.patient?.dob;
    case "type": return ctx.appointment?.type;
    case "date": return ctx.appointment?.date;
    case "reason": return ctx.appointment?.reason;
    default: return undefined;
  }
}

function safeParseArray(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return isNaN(d.getTime()) ? undefined : d;
}

function evaluateOperator(operator: ConditionOperator, actual: string | undefined, raw: string): boolean {
  const a = (actual ?? "").toString();
  switch (operator) {
    case "equals": return a.toLowerCase() === raw.toLowerCase();
    case "not_equals": return a.toLowerCase() !== raw.toLowerCase();
    case "in": return safeParseArray(raw).some((v) => v.toLowerCase() === a.toLowerCase());
    case "contains": return a.toLowerCase().includes(raw.toLowerCase());
    case "is_empty": return a.trim() === "";
    case "is_not_empty": return a.trim() !== "";
    case "before": {
      const d = parseDate(a), r = parseDate(raw);
      return !!d && !!r && d.getTime() < r.getTime();
    }
    case "after": {
      const d = parseDate(a), r = parseDate(raw);
      return !!d && !!r && d.getTime() > r.getTime();
    }
    case "between": {
      const [start, end] = safeParseArray(raw);
      const d = parseDate(a), s = parseDate(start), e = parseDate(end);
      return !!d && !!s && !!e && d.getTime() >= s.getTime() && d.getTime() <= e.getTime();
    }
    default: return false;
  }
}

/** v1 combines every condition with AND. groupNo/logic are reserved on the row for future OR support. */
export function evaluateConditions(ctx: EntityContext, conditions: WhatsappAutomationCondition[]): boolean {
  return conditions.every((c) => evaluateOperator(c.operator, resolveFieldValue(ctx, c.field), c.value));
}

// ---- Variables & recipient resolution ----

function firstName(name?: string): string {
  if (!name) return "";
  return name.trim().split(/\s+/)[0] || "";
}

export function buildVariableContext(ctx: EntityContext): Record<string, string> {
  const vars: Record<string, string> = {
    "clinic.name": CLINIC_NAME,
    "clinic.address": CLINIC_ADDRESS,
  };
  if (ctx.lead) {
    vars["lead.name"] = ctx.lead.name;
    vars["lead.firstName"] = firstName(ctx.lead.name);
    vars["lead.phone"] = ctx.lead.phone || "";
    vars["lead.source"] = ctx.lead.source;
    vars["lead.status"] = ctx.lead.status;
  }
  if (ctx.patient) {
    vars["patient.name"] = ctx.patient.name;
    vars["patient.firstName"] = firstName(ctx.patient.name);
    vars["patient.phone"] = ctx.patient.phone;
    vars["patient.department"] = ctx.patient.department || "";
  }
  if (ctx.appointment) {
    vars["appointment.date"] = ctx.appointment.date;
    vars["appointment.time"] = ctx.appointment.time;
    vars["appointment.reason"] = ctx.appointment.reason;
    vars["appointment.type"] = ctx.appointment.type || "";
  }
  return vars;
}

function sanitizeValue(value: string): string {
  // Strip control chars/newlines and cap length - templates are single-line
  // by convention and QuickAuth substitutes these verbatim.
  return value.replace(/[\r\n\t]+/g, " ").replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, 300);
}

export function renderStepVariables(step: WhatsappAutomationStep, ctx: EntityContext, overrides?: Record<string, string>): Record<string, string> {
  const context = { ...buildVariableContext(ctx), ...(overrides || {}) };
  const out: Record<string, string> = {};
  for (const [templateVarName, contextKey] of Object.entries(step.variableMapping || {})) {
    out[templateVarName] = sanitizeValue(context[contextKey] ?? overrides?.[templateVarName] ?? "");
  }
  return out;
}

/** Best-effort human preview. QuickAuth template bodies use {{1}},{{2}}... in the *declared variable order* - not the named `variables` map used at send time. */
export function renderPreviewText(templateBody: string, templateVariables: { name: string }[], values: Record<string, string>): string {
  let text = templateBody || "";
  templateVariables.forEach((v, idx) => {
    const placeholder = `{{${idx + 1}}}`;
    text = text.split(placeholder).join(values[v.name] ?? `{{${v.name}}}`);
  });
  return text;
}

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return "";
  // Clinic operates in India; matches the existing wa.me deep-link convention
  // used elsewhere in the app (appointment-master.tsx, crm-dashboard.tsx).
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function resolveRecipientPhone(rule: WhatsappAutomationRuleDetail, ctx: EntityContext): string {
  if (rule.targetAudience === "custom_phone") return normalizePhone(rule.customPhone);
  const raw = ctx.lead?.phone || ctx.patient?.phone || "";
  return normalizePhone(raw);
}

// ---- Delay math ----

function unitMs(unit: DelayUnit): number {
  switch (unit) {
    case "minutes": return 60_000;
    case "hours": return 3_600_000;
    case "days": return 86_400_000;
    default: return 3_600_000;
  }
}

function nextOccurrenceOfTime(hhmm: string, from: Date): Date {
  const [h, m] = (hhmm || "09:00").split(":").map(Number);
  const candidate = new Date(from);
  candidate.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  if (candidate.getTime() <= from.getTime()) candidate.setDate(candidate.getDate() + 1);
  return candidate;
}

function computeScheduledAt(step: WhatsappAutomationStep, baseTime: Date): Date {
  if (step.delayType === "immediate") return baseTime;
  if (step.delayType === "specific_time") return nextOccurrenceOfTime(step.specificTime, baseTime);
  return new Date(baseTime.getTime() + step.delayValue * unitMs(step.delayUnit));
}

// ---- Stop conditions ----

async function checkStopCondition(type: StopConditionType, run: WhatsappAutomationRun, ctx: EntityContext): Promise<boolean> {
  switch (type) {
    case "lead_converted":
      return ctx.lead?.status === "Converted" || !!ctx.lead?.convertedPatientId;
    case "lead_lost":
      return ctx.lead?.status === "Lost";
    case "opted_out": {
      const phone = normalizePhone(ctx.lead?.phone || ctx.patient?.phone || "");
      return phone ? storage.isOptedOut(phone) : false;
    }
    case "lead_replied": {
      const phone = normalizePhone(ctx.lead?.phone || ctx.patient?.phone || "");
      if (!phone) return false;
      const session = await storage.getConversationSession(phone);
      if (!session?.lastInboundAt) return false;
      return new Date(session.lastInboundAt).getTime() > new Date(run.startedAt).getTime();
    }
    case "appointment_booked": {
      const patientId = ctx.patient?.id || ctx.lead?.convertedPatientId;
      if (!patientId) return false;
      const appts = await storage.getAppointmentsByPatient(patientId);
      return appts.length > 0;
    }
    case "manually_stopped":
      // Set directly via the "stop run" API action, not detected here.
      return false;
    default:
      return false;
  }
}

/** Re-checked before queuing every step (and again by the worker right before send). */
export async function isRunStillEligible(run: WhatsappAutomationRun, rule: WhatsappAutomationRuleDetail, ctxIn?: EntityContext): Promise<boolean> {
  const freshRun = await storage.getWhatsappRun(run.id);
  if (!freshRun || freshRun.status !== "active") return false;

  const ctx = ctxIn ?? (await loadEntity(run.entityType, run.entityId));
  if (!ctx) {
    await storage.stopWhatsappRun(run.id, "Entity no longer exists");
    return false;
  }

  const phone = resolveRecipientPhone(rule, ctx);
  if (phone && (await storage.isOptedOut(phone))) {
    await storage.stopWhatsappRun(run.id, STOP_CONDITION_LABELS.opted_out);
    return false;
  }

  for (const stopType of rule.stopConditions) {
    if (await checkStopCondition(stopType, freshRun, ctx)) {
      await storage.stopWhatsappRun(run.id, STOP_CONDITION_LABELS[stopType]);
      return false;
    }
  }
  return true;
}

// ---- Run lifecycle ----

async function scheduleStep(run: WhatsappAutomationRun, rule: WhatsappAutomationRuleDetail, stepIndex: number, forceImmediate = false): Promise<void> {
  const step = rule.steps[stepIndex];
  if (!step) {
    await storage.completeWhatsappRun(run.id);
    return;
  }

  const ctx = await loadEntity(run.entityType, run.entityId);
  if (!ctx) {
    await storage.stopWhatsappRun(run.id, "Entity no longer exists");
    return;
  }
  if (!(await isRunStillEligible(run, rule, ctx))) return;

  const phone = resolveRecipientPhone(rule, ctx);
  if (!phone) {
    await storage.stopWhatsappRun(run.id, "No phone number available for recipient");
    return;
  }

  const baseTime = new Date(run.startedAt);
  const scheduledAt = forceImmediate && stepIndex === 0 ? new Date() : computeScheduledAt(step, baseTime);
  const variables = renderStepVariables(step, ctx);

  const template = await storage.getWhatsappTemplate(step.templateId);
  const preview = template
    ? renderPreviewText(template.body, template.variables, variables)
    : `[Template "${step.templateId}" not yet synced from QuickAuth]`;

  await storage.createWhatsappJob({
    runId: run.id,
    stepId: step.id,
    ruleId: rule.id,
    entityType: run.entityType,
    entityId: run.entityId,
    phone,
    templateId: step.templateId,
    messageType: step.messageType,
    variables,
    renderedPreview: preview,
    scheduledAt,
    idempotencyKey: `${run.id}:${step.id}`,
  });
  await storage.updateWhatsappRunProgress(run.id, stepIndex);
}

/** Idempotent: no-op if a run for this rule+entity+trigger already exists (spec section 16). */
export async function startRun(rule: WhatsappAutomationRuleDetail, entityType: WhatsappEntityType, entityId: string, triggerEvent: string): Promise<void> {
  const ctx = await loadEntity(entityType, entityId);
  if (!ctx) return;
  if (!evaluateConditions(ctx, rule.conditions)) return;

  const phone = resolveRecipientPhone(rule, ctx);
  if (phone && (await storage.isOptedOut(phone))) return;

  const run = await storage.createWhatsappRun(rule.id, entityType, entityId, triggerEvent);
  if (!run) return; // duplicate trigger for the same entity - already handled

  const timing = TRIGGER_DEFINITIONS[rule.triggerType]?.timing;
  await scheduleStep(run, rule, 0, timing === "scheduled");
}

/** Called by the worker after a step's message finishes sending (success or permanent failure). */
export async function advanceRunAfterSend(runId: string): Promise<void> {
  const run = await storage.getWhatsappRun(runId);
  if (!run) return;
  const rule = await storage.getWhatsappRuleDetail(run.ruleId);
  if (!rule) {
    await storage.stopWhatsappRun(run.id, "Rule no longer exists");
    return;
  }
  const nextIndex = run.currentStep + 1;
  if (nextIndex >= rule.steps.length) {
    await storage.completeWhatsappRun(run.id);
    return;
  }
  if (!(await isRunStillEligible(run, rule))) return;
  await scheduleStep(run, rule, nextIndex);
}

// ---- Event bus wiring ----

async function stopMatchingRunsForEvent(payload: AutomationEventPayload): Promise<void> {
  const targets: { entityType: WhatsappEntityType; entityId: string; stopType: StopConditionType }[] = [];

  if (payload.trigger === "appointment_booked") {
    const appointment = await storage.getAppointment(payload.entityId);
    if (appointment) {
      targets.push({ entityType: "patient", entityId: appointment.patientId, stopType: "appointment_booked" });
      const leads = await storage.getLeads();
      const lead = leads.find((l) => l.convertedPatientId === appointment.patientId);
      if (lead) targets.push({ entityType: "lead", entityId: lead.id, stopType: "appointment_booked" });
    }
  } else if (payload.trigger === "lead_status_changed" && payload.entityType === "lead") {
    const lead = await storage.getLead(payload.entityId);
    if (lead?.status === "Converted") targets.push({ entityType: "lead", entityId: lead.id, stopType: "lead_converted" });
    if (lead?.status === "Lost") targets.push({ entityType: "lead", entityId: lead.id, stopType: "lead_lost" });
  }

  for (const target of targets) {
    const runs = await storage.getActiveWhatsappRunsForEntity(target.entityType, target.entityId);
    for (const run of runs) {
      const rule = await storage.getWhatsappRuleDetail(run.ruleId);
      if (rule?.stopConditions.includes(target.stopType)) {
        await storage.stopWhatsappRun(run.id, STOP_CONDITION_LABELS[target.stopType]);
      }
    }
  }
}

async function handleAutomationEvent(payload: AutomationEventPayload): Promise<void> {
  const settings = await storage.getWhatsappSettings();
  if (!settings.enabled) return;

  const rules = await storage.getActiveWhatsappRulesByTrigger(payload.trigger);
  for (const rule of rules) {
    await startRun(rule, payload.entityType, payload.entityId, payload.trigger);
  }

  await stopMatchingRunsForEvent(payload);
}

let listenerRegistered = false;

/** Call once at server startup. Safe to call multiple times (no-ops after the first). */
export function registerAutomationEngine(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;
  automationEvents.on(AUTOMATION_EVENT, (payload: AutomationEventPayload) => {
    handleAutomationEvent(payload).catch((err) => {
      console.error("[whatsapp-engine] Failed to handle automation event", payload, err);
    });
  });
}
