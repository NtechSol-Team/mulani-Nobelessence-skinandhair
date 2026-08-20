import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { checkPermission } from "../auth";
import * as quickauth from "./quickauthClient";
import { QuickAuthApiError } from "./quickauthClient";
import { handleWhatsappWebhook } from "./webhook";
import { loadEntity, evaluateConditions, renderStepVariables, renderPreviewText, resolveRecipientPhone } from "./engine";
import {
  insertRuleSchema,
  insertTemplateDraftSchema,
  updateSettingsSchema,
  testSendSchema,
  type WhatsappTemplate,
} from "@shared/schema";

function normalizeTestPhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function loadTestContext(body: any) {
  if (body?.leadId) return loadEntity("lead", body.leadId);
  if (body?.patientId) return loadEntity("patient", body.patientId);
  if (body?.appointmentId) return loadEntity("appointment", body.appointmentId);
  return undefined;
}

/** Public webhook - no session auth. Must be registered before the /api auth gate in routes.ts (same as /api/health). */
export function registerWhatsappWebhookRoute(app: Express) {
  app.post("/api/webhooks/whatsapp", async (req, res) => {
    try {
      await handleWhatsappWebhook(req.body);
    } catch (error) {
      console.error("Error handling WhatsApp webhook:", error);
    }
    // Always ack 200 so the provider doesn't retry-storm us; the raw payload
    // is stored regardless of whether we understood it (see webhook.ts).
    res.status(200).json({ received: true });
  });
}

export function registerWhatsappRoutes(app: Express) {
  // ==================== SETTINGS ====================
  app.get("/api/whatsapp/settings", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await storage.getWhatsappSettings());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch WhatsApp settings" });
    }
  });

  app.patch("/api/whatsapp/settings", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const validated = updateSettingsSchema.parse(req.body);
      const settings = await storage.updateWhatsappSettings(validated);
      const user = req.user as any;
      await storage.logWhatsappAudit("settings_updated", undefined, user?.id, user?.username, validated);
      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update WhatsApp settings" });
    }
  });

  app.get("/api/whatsapp/health", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await quickauth.getHealth());
    } catch (error) {
      if (error instanceof QuickAuthApiError) return res.status(error.status || 502).json({ error: error.message, code: error.code });
      res.status(500).json({ error: "Failed to fetch WhatsApp account health" });
    }
  });

  // ==================== TEMPLATES ====================
  app.get("/api/whatsapp/templates", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await storage.getWhatsappTemplates());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.post("/api/whatsapp/templates/sync", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const remoteTemplates = await quickauth.listTemplates();
      const saved: WhatsappTemplate[] = [];
      for (const t of remoteTemplates) {
        if (!t.templateId) continue;
        saved.push(
          await storage.upsertWhatsappTemplate({
            templateId: t.templateId,
            name: t.name,
            language: t.language || "en",
            category: t.category || "UTILITY",
            status: t.status || "DRAFT",
            headerType: t.headerType,
            headerText: t.headerText,
            body: t.body || "",
            footer: t.footer || "",
            variables: t.variables || [],
            buttons: t.buttons || [],
            lastSyncedAt: new Date().toISOString(),
          })
        );
      }
      res.json({ synced: saved.length, templates: saved });
    } catch (error) {
      if (error instanceof QuickAuthApiError) return res.status(error.status || 502).json({ error: error.message, code: error.code });
      res.status(500).json({ error: "Failed to sync templates from QuickAuth" });
    }
  });

  app.post("/api/whatsapp/templates", checkPermission("whatsappAutomation", "add"), async (req, res) => {
    try {
      const validated = insertTemplateDraftSchema.parse(req.body);
      const created = await quickauth.createTemplate(validated);
      if (!created.templateId) return res.status(502).json({ error: "QuickAuth did not return a template id" });
      const saved = await storage.upsertWhatsappTemplate({
        templateId: created.templateId,
        name: created.name || validated.name,
        language: created.language || validated.language,
        category: created.category || validated.category,
        status: created.status || "DRAFT",
        headerType: created.headerType,
        headerText: created.headerText,
        body: created.body || validated.body,
        footer: created.footer || validated.footer || "",
        variables: created.variables || validated.variables,
        buttons: created.buttons || validated.buttons || [],
        lastSyncedAt: new Date().toISOString(),
      });
      const user = req.user as any;
      await storage.logWhatsappAudit("template_created", undefined, user?.id, user?.username, { templateId: saved.templateId });
      res.status(201).json(saved);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      if (error instanceof QuickAuthApiError) return res.status(error.status || 502).json({ error: error.message, code: error.code });
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.get("/api/whatsapp/templates/:id", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      const cached = await storage.getWhatsappTemplate(req.params.id);
      if (cached) return res.json(cached);
      const remote = await quickauth.getTemplate(req.params.id);
      res.json(remote);
    } catch (error) {
      if (error instanceof QuickAuthApiError) return res.status(error.status || 502).json({ error: error.message, code: error.code });
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // ==================== RULES ====================
  app.get("/api/whatsapp/rules", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await storage.getWhatsappRules());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation rules" });
    }
  });

  app.get("/api/whatsapp/rules/:id", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      const rule = await storage.getWhatsappRuleDetail(req.params.id);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch rule" });
    }
  });

  app.post("/api/whatsapp/rules", checkPermission("whatsappAutomation", "add"), async (req, res) => {
    try {
      const validated = insertRuleSchema.parse(req.body);
      const user = req.user as any;
      const rule = await storage.createWhatsappRule(validated, user?.username || user?.id || "unknown");
      await storage.logWhatsappAudit("rule_created", rule.id, user?.id, user?.username, { name: rule.name });
      res.status(201).json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to create automation rule" });
    }
  });

  app.patch("/api/whatsapp/rules/:id", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const validated = insertRuleSchema.parse(req.body);
      const rule = await storage.updateWhatsappRule(req.params.id, validated);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      const user = req.user as any;
      await storage.logWhatsappAudit("rule_updated", rule.id, user?.id, user?.username, { name: rule.name });
      res.json(rule);
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      res.status(500).json({ error: "Failed to update automation rule" });
    }
  });

  app.patch("/api/whatsapp/rules/:id/status", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const status = req.body?.status;
      if (status !== "Active" && status !== "Inactive") return res.status(400).json({ error: "Invalid status" });
      const rule = await storage.updateWhatsappRuleStatus(req.params.id, status);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      const user = req.user as any;
      await storage.logWhatsappAudit(status === "Active" ? "rule_activated" : "rule_deactivated", rule.id, user?.id, user?.username, {});
      res.json(rule);
    } catch (error) {
      res.status(500).json({ error: "Failed to update rule status" });
    }
  });

  app.delete("/api/whatsapp/rules/:id", checkPermission("whatsappAutomation", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteWhatsappRule(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Rule not found" });
      const user = req.user as any;
      await storage.logWhatsappAudit("rule_deleted", req.params.id, user?.id, user?.username, {});
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete automation rule" });
    }
  });

  // ==================== TEST MODE ====================
  app.post("/api/whatsapp/rules/:id/test", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const rule = await storage.getWhatsappRuleDetail(req.params.id);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      const stepIndex = Number(req.body?.stepIndex ?? 0);
      const step = rule.steps[stepIndex];
      if (!step) return res.status(400).json({ error: "Invalid step index" });

      const ctx = await loadTestContext(req.body);
      if (!ctx) return res.status(400).json({ error: "Select a lead, patient, or appointment to preview with" });

      const conditionsPass = evaluateConditions(ctx, rule.conditions);
      const variables = renderStepVariables(step, ctx, req.body?.overrides || {});
      const template = await storage.getWhatsappTemplate(step.templateId);
      const renderedMessage = template
        ? renderPreviewText(template.body, template.variables, variables)
        : `[Template "${step.templateId}" not yet synced from QuickAuth]`;
      const phone = resolveRecipientPhone(rule, ctx);

      res.json({ conditionsPass, phone, variables, renderedMessage, templateStatus: template?.status || "unknown" });
    } catch (error) {
      res.status(500).json({ error: "Failed to build test preview" });
    }
  });

  app.post("/api/whatsapp/rules/:id/test-send", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const rule = await storage.getWhatsappRuleDetail(req.params.id);
      if (!rule) return res.status(404).json({ error: "Rule not found" });
      const validated = testSendSchema.parse(req.body);
      const stepIndex = Number(req.body?.stepIndex ?? 0);
      const step = rule.steps[stepIndex];
      if (!step) return res.status(400).json({ error: "Invalid step index" });

      const ctx = await loadTestContext(req.body);
      const variables = ctx ? renderStepVariables(step, ctx, validated.overrides) : validated.overrides;
      const phone = normalizeTestPhone(validated.phone);

      const result = await quickauth.sendTemplateMessage({ templateId: step.templateId, to: phone, variables });
      const user = req.user as any;
      await storage.logWhatsappAudit("test_message_sent", rule.id, user?.id, user?.username, { phone, stepIndex });
      res.json({ sent: true, campaignId: result.campaignId });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
      if (error instanceof QuickAuthApiError) return res.status(error.status || 502).json({ error: error.message, code: error.code });
      res.status(500).json({ error: "Failed to send test message" });
    }
  });

  // ==================== RUNS ====================
  app.get("/api/whatsapp/runs", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      const { status, ruleId, limit, offset } = req.query as Record<string, string>;
      res.json(await storage.getWhatsappRuns({
        status, ruleId,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      }));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation runs" });
    }
  });

  app.post("/api/whatsapp/runs/:id/stop", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      await storage.stopWhatsappRun(req.params.id, "Manually stopped by staff");
      const user = req.user as any;
      await storage.logWhatsappAudit("run_manually_stopped", undefined, user?.id, user?.username, { runId: req.params.id });
      res.json({ stopped: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to stop automation run" });
    }
  });

  // ==================== MESSAGE HISTORY ====================
  app.get("/api/whatsapp/messages", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      const { status, ruleId, entityId, limit, offset } = req.query as Record<string, string>;
      res.json(await storage.getWhatsappMessageJobs({
        status, ruleId, entityId,
        limit: limit ? Number(limit) : undefined,
        offset: offset ? Number(offset) : undefined,
      }));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message history" });
    }
  });

  // ==================== DASHBOARD ====================
  app.get("/api/whatsapp/dashboard", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await storage.getWhatsappDashboardStats());
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard stats" });
    }
  });

  // ==================== AUDIT LOG ====================
  app.get("/api/whatsapp/audit-log", checkPermission("whatsappAutomation", "view"), async (req, res) => {
    try {
      res.json(await storage.getWhatsappAuditLog(req.query.ruleId as string | undefined));
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch audit log" });
    }
  });

  // ==================== OPT-OUTS ====================
  app.post("/api/whatsapp/opt-outs", checkPermission("whatsappAutomation", "edit"), async (req, res) => {
    try {
      const digits = String(req.body?.phone || "").replace(/\D/g, "");
      if (!digits) return res.status(400).json({ error: "Phone number is required" });
      await storage.addWhatsappOptOut(digits.length === 10 ? `91${digits}` : digits, "manual");
      res.json({ optedOut: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to record opt-out" });
    }
  });
}
