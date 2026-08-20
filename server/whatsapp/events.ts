// In-process event bus that decouples CRM route handlers from the automation
// engine. Route handlers call the emit* helpers right after an existing DB
// write succeeds; the engine (registered in index.ts / engine.ts) listens and
// decides which rules to run. Nothing here talks to the database directly.

import { EventEmitter } from "events";
import type { Lead, Appointment, Patient } from "@shared/schema";
import type { WhatsappTriggerType } from "@shared/schema";

export interface AutomationEventPayload {
  trigger: WhatsappTriggerType;
  entityType: "lead" | "patient" | "appointment";
  entityId: string;
}

class AutomationEventBus extends EventEmitter {}

export const automationEvents = new AutomationEventBus();
// Rule matching can be slow relative to the HTTP request; keep this bus
// purely fire-and-forget so a slow/erroring listener never affects the
// CRM request that triggered it.
automationEvents.setMaxListeners(20);

export const AUTOMATION_EVENT = "automation-trigger";

function emit(payload: AutomationEventPayload) {
  // Defer to the next tick so the emitting route handler's response is never
  // blocked or affected by listener execution/errors.
  setImmediate(() => automationEvents.emit(AUTOMATION_EVENT, payload));
}

export function emitLeadCreated(lead: Lead) {
  emit({ trigger: "lead_created", entityType: "lead", entityId: lead.id });
}

export function emitLeadStatusChanged(lead: Lead, previousStatus: string) {
  if (lead.status === previousStatus) return;
  emit({ trigger: "lead_status_changed", entityType: "lead", entityId: lead.id });
}

export function emitPatientRegistered(patient: Patient) {
  emit({ trigger: "patient_registered", entityType: "patient", entityId: patient.id });
}

export function emitAppointmentBooked(appointment: Appointment) {
  emit({ trigger: "appointment_booked", entityType: "appointment", entityId: appointment.id });
}

export function emitAppointmentStatusChanged(appointment: Appointment, previousStatus: string) {
  if (appointment.status === previousStatus) return;
  if (appointment.status === "Cancelled") {
    emit({ trigger: "appointment_cancelled", entityType: "appointment", entityId: appointment.id });
  } else if (appointment.status === "Completed") {
    emit({ trigger: "appointment_completed", entityType: "appointment", entityId: appointment.id });
  }
}
