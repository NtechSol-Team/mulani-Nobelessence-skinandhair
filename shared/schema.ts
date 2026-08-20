import { z } from "zod";

export interface User {
  id: string;
  username: string;
  role: "SuperAdmin" | "Staff";
  permissions?: Record<string, { view: boolean; add: boolean; edit: boolean; delete: boolean; fields?: Record<string, boolean> }>;
  createdAt: string;
}

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SuperAdmin", "Staff"]).default("Staff"),
  permissions: z.record(z.object({
    view: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    fields: z.record(z.boolean()).optional(),
  })).optional().default({}),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Patient Schema
export interface Patient {
  id: string;
  name: string;
  phone: string;
  registrationDate: string;
  dob?: string;
  status: "Active" | "Inactive" | "VIP";
  source: string;
  department?: string;
}

export const insertPatientSchema = z.object({
  name: z.string().min(1, "Patient name is required"),
  phone: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits"),
  registrationDate: z.string(),
  dob: z.string().optional().default(""),
  status: z.enum(["Active", "Inactive", "VIP"]).default("Active"),
  source: z.string().default("Walk-in"),
  department: z.string().optional().default(""),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;

export interface ConsumedMedicineItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
}

// Visit Schema
export interface Visit {
  id: string;
  patientId: string;
  date: string;
  complaints: string;
  diagnosis: string;
  visitNumber: number;
  prescription?: string;
  consumedMedicines?: ConsumedMedicineItem[];
}

export const insertVisitSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  complaints: z.string().optional().default(""),
  diagnosis: z.string().optional().default(""),
  prescription: z.string().optional().default(""),
  consumedMedicines: z.array(z.object({
    medicineId: z.string(),
    medicineName: z.string(),
    quantity: z.number().min(1),
  })).optional().default([]),
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;

// Medicine Schema
export interface Medicine {
  id: string;
  name: string;
  purchaseCost: number;
  sellingPrice: number;
  quantity: number;
  type: "Medicine" | "Equipment";
  vendorName?: string;
}

export const insertMedicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  purchaseCost: z.number().min(0, "Purchase cost must be positive"),
  sellingPrice: z.number().min(0, "Selling price must be positive"),
  quantity: z.number().min(0, "Quantity must be positive"),
  type: z.enum(["Medicine", "Equipment"]).default("Medicine"),
  vendorName: z.string().optional().default(""),
});

export type InsertMedicine = z.infer<typeof insertMedicineSchema>;

// Treatment Schema
export interface TreatmentEquipmentItem {
  medicineId: string;
  quantity: number;
}

export interface Treatment {
  id: string;
  name: string;
  defaultPrice: number;
  type: "General" | "Surgery";
  equipments?: TreatmentEquipmentItem[];
}

export const insertTreatmentSchema = z.object({
  name: z.string().min(1, "Treatment name is required"),
  defaultPrice: z.number().min(0, "Price must be positive"),
  type: z.enum(["General", "Surgery"]).default("General"),
  equipments: z.array(z.object({
    medicineId: z.string(),
    quantity: z.number().min(1),
  })).optional().default([]),
});

export type InsertTreatment = z.infer<typeof insertTreatmentSchema>;

// Bill Item for medicines in a bill
export interface BillMedicineItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number; // User input percentage
  discount?: number; // Calculated amount
  total: number;
}

// Bill Item for treatments in a bill
export interface BillTreatmentItem {
  treatmentId: string;
  treatmentName: string;
  price: number;
  equipments?: TreatmentEquipmentItem[];
}

// Bill Schema
export interface Bill {
  id: string;
  patientId: string;
  patientName: string;
  date: string;
  treatments: BillTreatmentItem[];
  medicines: BillMedicineItem[];
  treatmentTotal: number;
  medicineTotal: number;
  grandTotal: number;
  discount: number;
  discountType: "Percentage" | "INR";
  finalAmount: number;
  amountPaid: number;
  pendingAmount: number;
}

export const insertBillSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  date: z.string(),
  treatments: z.array(z.object({
    treatmentId: z.string(),
    treatmentName: z.string(),
    price: z.number(),
    equipments: z.array(z.object({
      medicineId: z.string(),
      quantity: z.number().min(1),
    })).optional(),
  })),
  medicines: z.array(z.object({
    medicineId: z.string(),
    medicineName: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    discountPercent: z.number().min(0).max(100).optional().default(0),
    discount: z.number().min(0).optional().default(0),
    total: z.number(),
  })),
  treatmentTotal: z.number(),
  medicineTotal: z.number(),
  grandTotal: z.number(),
  discount: z.number().default(0),
  discountType: z.enum(["Percentage", "INR"]).default("Percentage"),
  finalAmount: z.number(),
  amountPaid: z.number().min(0),
  paymentMode: z.enum(["Cash", "Online"]).default("Cash"),
});

export type InsertBill = z.infer<typeof insertBillSchema>;

// Expense Schema
export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: string;
}

export const insertExpenseSchema = z.object({
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0, "Amount must be positive"),
  date: z.string(),
  category: z.string().min(1, "Category is required"),
});

export type InsertExpense = z.infer<typeof insertExpenseSchema>;

// Payment adjustment schema
export const paymentAdjustmentSchema = z.object({
  billId: z.string(),
  amountPaid: z.number().min(0),
});

export type PaymentAdjustment = z.infer<typeof paymentAdjustmentSchema>;

// Report types
export interface MonthlyReport {
  month: string;
  year: number;
  totalRevenue: number;
  totalExpenses: number;
  profit: number;
  treatmentRevenue: number;
  medicineRevenue: number;
  medicineProfit: number;
}

export interface MedicineReport {
  medicineId: string;
  medicineName: string;
  quantitySold: number;
  totalRevenue: number;
  totalCost: number;
  profit: number;
}

// Pagination Schema
export const paginationSchema = z.object({
  // Increase default and maximum limits to allow larger page sizes when needed.
  // Be cautious: very large limits can increase DB load; use sensible bounds for your workload.
  limit: z.coerce.number().int().positive().max(1000).default(1000),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

// Appointment Schema
export interface Appointment {
  id: string;
  patientId: string;
  patientName?: string; // Optional, for display purposes
  date: string;
  time: string; // Time string like "14:30"
  reason: string;
  status: string; // "Scheduled", "Completed", "Cancelled"
  isUpcoming: boolean; // Computed or stored
  type?: "New" | "Follow-up";
}

export const insertAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  time: z.string().default("09:00"),
  reason: z.string().optional().default(""),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
  type: z.enum(["New", "Follow-up"]).default("New"),
});

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

// Payment Ledger Schema
export interface PaymentLedger {
  id: string;
  billId: string;
  patientId: string;
  amount: number;
  date: string;
  paymentMode: "Cash" | "Online";
}

export const insertPaymentLedgerSchema = z.object({
  billId: z.string().min(1, "Bill ID is required"),
  patientId: z.string().min(1, "Patient ID is required"),
  amount: z.number().min(0, "Amount must be positive"),
  date: z.string(),
  paymentMode: z.enum(["Cash", "Online"]).default("Cash"),
});

export type InsertPaymentLedger = z.infer<typeof insertPaymentLedgerSchema>;

// Lead Schema
export interface Lead {
  id: string;
  name: string;
  phone?: string;
  status: "New" | "Hot" | "Warm" | "Cold" | "Converted" | "Lost";
  source: string;
  notes: string;
  createdAt: string;
  convertedPatientId?: string;
}

export const insertLeadSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().nullish().transform(val => val ?? "")
    .refine(val => val === "" || /^\d{10}$/.test(val), {
      message: "Phone number must be exactly 10 digits"
    }),
  status: z.enum(["New", "Hot", "Warm", "Cold", "Converted", "Lost"]).default("New"),
  source: z.string().default("Instagram"),
  notes: z.string().nullish().transform(val => val ?? ""),
  createdAt: z.string(),
  convertedPatientId: z.string().nullish().transform(val => val || undefined),
});

export type InsertLead = z.infer<typeof insertLeadSchema>;

// CRM Interaction Schema
export interface CRMInteraction {
  id: string;
  patientId?: string;
  leadId?: string;
  date: string;
  type: "Inquiry" | "Follow-up" | "Treatment Feedback" | "Complaint" | "Birthday Wish" | "Appointment Confirmation";
  channel: "Call" | "WhatsApp" | "Email" | "In-Person";
  notes: string;
  outcome: string;
}

export const insertCRMInteractionSchema = z.object({
  patientId: z.string().optional(),
  leadId: z.string().optional(),
  date: z.string(),
  type: z.enum(["Inquiry", "Follow-up", "Treatment Feedback", "Complaint", "Birthday Wish", "Appointment Confirmation"]),
  channel: z.enum(["Call", "WhatsApp", "Email", "In-Person"]),
  notes: z.string().min(1, "Notes are required"),
  outcome: z.string().optional().default(""),
});

export type InsertCRMInteraction = z.infer<typeof insertCRMInteractionSchema>;

// CRM Task Schema
export interface CRMTask {
  id: string;
  description: string;
  patientId?: string;
  patientName?: string;
  leadId?: string;
  leadName?: string;
  dueDate: string;
  status: "Pending" | "Completed";
  priority: "Low" | "Medium" | "High";
}

export const insertCRMTaskSchema = z.object({
  description: z.string().min(1, "Description is required"),
  patientId: z.string().optional(),
  leadId: z.string().optional(),
  dueDate: z.string(),
  status: z.enum(["Pending", "Completed"]).default("Pending"),
  priority: z.enum(["Low", "Medium", "High"]).default("Medium"),
});

export type InsertCRMTask = z.infer<typeof insertCRMTaskSchema>;


// Department Schema
export interface Department {
  id: string;
  name: string;
}

export const insertDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required"),
});

export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;

// ============================================================================
// WhatsApp Automation / Rule Engine
// ============================================================================
// Generic engine: CRM Event -> Rule Engine -> Condition Evaluator ->
// Automation Run -> Steps -> Message Jobs -> Queue -> WhatsApp Worker -> Provider.
// v1 ships WhatsApp only; `channel` fields exist so SMS/Email can be added
// later without redesigning the engine.

export const WHATSAPP_ENTITY_TYPES = ["lead", "patient", "appointment"] as const;
export type WhatsappEntityType = typeof WHATSAPP_ENTITY_TYPES[number];

// Trigger catalogue. Adding a new trigger later = add an entry here + wire one
// emit call (event-timing) or one scheduler scan (scheduled-timing) - no
// redesign of the engine, condition evaluator, or UI required.
export const WHATSAPP_TRIGGER_TYPES = [
  "lead_created",
  "lead_status_changed",
  "lead_follow_up_missed",
  "patient_registered",
  "patient_birthday",
  "appointment_booked",
  "appointment_cancelled",
  "appointment_completed",
  "appointment_reminder",
] as const;
export type WhatsappTriggerType = typeof WHATSAPP_TRIGGER_TYPES[number];

export interface TriggerDefinition {
  label: string;
  description: string;
  entity: WhatsappEntityType;
  /** "event": fires the instant the CRM action happens. "scheduled": the scheduler scans for eligibility. */
  timing: "event" | "scheduled";
}

export const TRIGGER_DEFINITIONS: Record<WhatsappTriggerType, TriggerDefinition> = {
  lead_created: { label: "New Lead Created", description: "Fires immediately when a lead is added to the CRM.", entity: "lead", timing: "event" },
  lead_status_changed: { label: "Lead Status Changed", description: "Fires when a lead's status (New/Hot/Warm/Cold/Converted/Lost) changes.", entity: "lead", timing: "event" },
  lead_follow_up_missed: { label: "Lead Follow-up Missed", description: "Fires once a lead has had no logged interaction for the configured number of days.", entity: "lead", timing: "scheduled" },
  patient_registered: { label: "Patient Registered", description: "Fires immediately when a new patient is registered.", entity: "patient", timing: "event" },
  patient_birthday: { label: "Patient Birthday", description: "Fires on the patient's date of birth every year.", entity: "patient", timing: "scheduled" },
  appointment_booked: { label: "Appointment Booked", description: "Fires immediately when an appointment is created.", entity: "appointment", timing: "event" },
  appointment_cancelled: { label: "Appointment Cancelled", description: "Fires when an appointment's status changes to Cancelled.", entity: "appointment", timing: "event" },
  appointment_completed: { label: "Appointment Completed", description: "Fires when an appointment's status changes to Completed.", entity: "appointment", timing: "event" },
  appointment_reminder: { label: "Appointment Reminder", description: "Fires a configurable amount of time before a Scheduled appointment's date/time.", entity: "appointment", timing: "scheduled" },
};

// Condition field catalogue - deliberately scoped to fields that exist today
// on Lead/Patient/Appointment. Fields like doctor/branch/campaign aren't in
// the data model yet; adding them later is additive (new row here + a
// resolver in engine.ts), not a redesign.
export type ConditionFieldType = "enum" | "text" | "date";

export interface ConditionFieldDefinition {
  key: string;
  label: string;
  type: ConditionFieldType;
  options?: string[];
}

export const CONDITION_FIELDS: Record<WhatsappEntityType, ConditionFieldDefinition[]> = {
  lead: [
    { key: "source", label: "Lead Source", type: "enum" },
    { key: "status", label: "Lead Status", type: "enum", options: ["New", "Hot", "Warm", "Cold", "Converted", "Lost"] },
    { key: "notes", label: "Notes", type: "text" },
    { key: "phone", label: "Phone Number", type: "text" },
    { key: "createdAt", label: "Lead Created Date", type: "date" },
  ],
  patient: [
    { key: "status", label: "Patient Status", type: "enum", options: ["Active", "Inactive", "VIP"] },
    { key: "source", label: "Source", type: "enum" },
    { key: "department", label: "Department", type: "enum" },
    { key: "registrationDate", label: "Registration Date", type: "date" },
    { key: "dob", label: "Date of Birth", type: "date" },
  ],
  appointment: [
    { key: "status", label: "Appointment Status", type: "enum", options: ["Scheduled", "Completed", "Cancelled"] },
    { key: "type", label: "Appointment Type", type: "enum", options: ["New", "Follow-up"] },
    { key: "date", label: "Appointment Date", type: "date" },
    { key: "reason", label: "Reason", type: "text" },
  ],
};

export const CONDITION_OPERATORS = [
  "equals", "not_equals", "in", "contains",
  "is_empty", "is_not_empty",
  "before", "after", "between",
] as const;
export type ConditionOperator = typeof CONDITION_OPERATORS[number];

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: "Equals",
  not_equals: "Not Equals",
  in: "Is One Of",
  contains: "Contains",
  is_empty: "Is Empty",
  is_not_empty: "Is Not Empty",
  before: "Before",
  after: "After",
  between: "Between",
};

// Variables an admin can map into a template's named variables. Grouped by
// the entity the rule's trigger is on; `clinic.*` is always available.
export const TEMPLATE_VARIABLE_SOURCES: Record<WhatsappEntityType | "clinic", { key: string; label: string }[]> = {
  lead: [
    { key: "lead.name", label: "Lead Name" },
    { key: "lead.firstName", label: "Lead First Name" },
    { key: "lead.phone", label: "Lead Phone" },
    { key: "lead.source", label: "Lead Source" },
    { key: "lead.status", label: "Lead Status" },
  ],
  patient: [
    { key: "patient.name", label: "Patient Name" },
    { key: "patient.firstName", label: "Patient First Name" },
    { key: "patient.phone", label: "Patient Phone" },
    { key: "patient.department", label: "Department" },
  ],
  appointment: [
    { key: "appointment.date", label: "Appointment Date" },
    { key: "appointment.time", label: "Appointment Time" },
    { key: "appointment.reason", label: "Appointment Reason / Treatment" },
    { key: "appointment.type", label: "Appointment Type" },
    { key: "patient.name", label: "Patient Name" },
    { key: "patient.phone", label: "Patient Phone" },
  ],
  clinic: [
    { key: "clinic.name", label: "Clinic Name" },
    { key: "clinic.address", label: "Clinic Address" },
  ],
};

export const STOP_CONDITION_TYPES = [
  "lead_replied",
  "lead_status_changed",
  "lead_converted",
  "lead_lost",
  "appointment_booked",
  "opted_out",
  "manually_stopped",
] as const;
export type StopConditionType = typeof STOP_CONDITION_TYPES[number];

export const STOP_CONDITION_LABELS: Record<StopConditionType, string> = {
  lead_replied: "Lead Replies on WhatsApp",
  lead_status_changed: "Lead Status Changes at All (New/Hot/Warm/Cold/Converted/Lost)",
  lead_converted: "Lead Converts to Patient",
  lead_lost: "Lead Marked Lost",
  appointment_booked: "Appointment Gets Booked",
  opted_out: "Contact Opts Out / Blocked",
  manually_stopped: "Staff Manually Stops It",
};

export const STEP_DELAY_TYPES = ["immediate", "after", "specific_time"] as const;
export type StepDelayType = typeof STEP_DELAY_TYPES[number];

export const DELAY_UNITS = ["minutes", "hours", "days"] as const;
export type DelayUnit = typeof DELAY_UNITS[number];

export const MESSAGE_TYPES = ["auto", "template"] as const;
export type MessageType = typeof MESSAGE_TYPES[number];

export const TARGET_AUDIENCES = ["primary_entity", "custom_phone"] as const;
export type TargetAudience = typeof TARGET_AUDIENCES[number];

// ---- Condition ----
export interface WhatsappAutomationCondition {
  id: string;
  ruleId: string;
  field: string;
  operator: ConditionOperator;
  value: string; // for "in"/"between" this is a JSON-encoded array; empty for is_empty/is_not_empty
  groupNo: number; // reserved for future OR/condition-groups; v1 combines everything in group 0 with AND
}

export const insertConditionSchema = z.object({
  field: z.string().min(1),
  operator: z.enum(CONDITION_OPERATORS),
  value: z.string().default(""),
  groupNo: z.number().int().default(0),
});
export type InsertCondition = z.infer<typeof insertConditionSchema>;

// ---- Step ----
export interface WhatsappAutomationStep {
  id: string;
  ruleId: string;
  stepOrder: number;
  delayType: StepDelayType;
  delayUnit: DelayUnit;
  delayValue: number;
  specificTime: string; // "HH:MM", used when delayType === "specific_time"
  templateId: string; // references whatsapp_templates.template_id (provider id)
  messageType: MessageType;
  variableMapping: Record<string, string>; // templateVariableName -> TEMPLATE_VARIABLE_SOURCES key
}

export const insertStepSchema = z.object({
  stepOrder: z.number().int().min(0).default(0),
  delayType: z.enum(STEP_DELAY_TYPES).default("immediate"),
  delayUnit: z.enum(DELAY_UNITS).default("hours"),
  delayValue: z.number().int().min(0).default(0),
  specificTime: z.string().default(""),
  templateId: z.string().min(1, "Select a template"),
  messageType: z.enum(MESSAGE_TYPES).default("auto"),
  variableMapping: z.record(z.string()).default({}),
});
export type InsertStep = z.infer<typeof insertStepSchema>;

// ---- Rule ----
export interface WhatsappAutomationRule {
  id: string;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  priority: "Low" | "Normal" | "High";
  triggerType: WhatsappTriggerType;
  triggerConfig: Record<string, any>; // e.g. { thresholdDays: 2 } for lead_follow_up_missed
  targetAudience: TargetAudience;
  customPhone: string;
  businessHoursOnly: boolean;
  maxPerContactPerDay: number; // 0 = use global default from whatsapp_settings
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const insertRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  description: z.string().default(""),
  status: z.enum(["Active", "Inactive"]).default("Inactive"),
  priority: z.enum(["Low", "Normal", "High"]).default("Normal"),
  triggerType: z.enum(WHATSAPP_TRIGGER_TYPES),
  triggerConfig: z.record(z.any()).default({}),
  targetAudience: z.enum(TARGET_AUDIENCES).default("primary_entity"),
  customPhone: z.string().default(""),
  businessHoursOnly: z.boolean().default(true),
  maxPerContactPerDay: z.number().int().min(0).default(0),
  conditions: z.array(insertConditionSchema).default([]),
  steps: z.array(insertStepSchema).min(1, "At least one message step is required"),
  stopConditions: z.array(z.enum(STOP_CONDITION_TYPES)).default([]),
});
export type InsertRule = z.infer<typeof insertRuleSchema>;

export interface WhatsappAutomationRuleDetail extends WhatsappAutomationRule {
  conditions: WhatsappAutomationCondition[];
  steps: WhatsappAutomationStep[];
  stopConditions: StopConditionType[];
}

// ---- Templates (synced cache from the QuickAuth provider) ----
export interface WhatsappTemplate {
  templateId: string;
  name: string;
  language: string;
  category: "UTILITY" | "MARKETING" | "AUTHENTICATION" | string;
  status: "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | string;
  headerType?: string;
  headerText?: string;
  body: string;
  footer?: string;
  variables: { name: string; example?: string }[];
  buttons?: any[];
  lastSyncedAt: string;
}

export const insertTemplateDraftSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  language: z.string().default("en"),
  category: z.enum(["UTILITY", "MARKETING", "AUTHENTICATION"]).default("UTILITY"),
  body: z.string().min(1, "Template body is required"),
  footer: z.string().optional().default(""),
  variables: z.array(z.object({ name: z.string().min(1), example: z.string().optional() })).default([]),
  buttons: z.array(z.any()).optional().default([]),
});
export type InsertTemplateDraft = z.infer<typeof insertTemplateDraftSchema>;

// ---- Runs & Messages ----
export type AutomationRunStatus = "active" | "completed" | "stopped";

export interface WhatsappAutomationRun {
  id: string;
  ruleId: string;
  ruleName?: string;
  entityType: WhatsappEntityType;
  entityId: string;
  entityName?: string;
  triggerEvent: string;
  currentStep: number;
  status: AutomationRunStatus;
  stopReason: string;
  startedAt: string;
  updatedAt: string;
}

export type MessageJobStatus =
  | "pending" | "queued" | "sending" | "sent" | "delivered" | "read"
  | "failed" | "cancelled" | "skipped";

export interface WhatsappMessageJob {
  id: string;
  runId: string;
  stepId: string;
  ruleId: string;
  ruleName?: string;
  entityType: WhatsappEntityType;
  entityId: string;
  entityName?: string;
  phone: string;
  templateId: string;
  templateName?: string;
  messageType: MessageType;
  variables: Record<string, string>;
  renderedPreview: string;
  status: MessageJobStatus;
  scheduledAt: string;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  providerMessageId?: string;
  campaignId?: string;
  attempts: number;
  maxAttempts: number;
  lastError?: string;
}

// ---- Conversation window state ----
export interface WhatsappConversationSession {
  phone: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  windowExpiresAt?: string;
  status: "open" | "closed";
}

// ---- Settings ----
export interface WhatsappSettings {
  enabled: boolean;
  businessHoursEnabled: boolean;
  businessHoursStart: string; // "HH:MM"
  businessHoursEnd: string; // "HH:MM"
  timezone: string; // IANA tz, e.g. "Asia/Kolkata"
  maxPerContactPerDay: number;
  minGapMinutes: number;
  webhookUrl?: string; // read-only, derived - shown for the admin to paste into the QuickAuth dashboard
}

export const updateSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  businessHoursEnabled: z.boolean().optional(),
  businessHoursStart: z.string().optional(),
  businessHoursEnd: z.string().optional(),
  timezone: z.string().optional(),
  maxPerContactPerDay: z.number().int().min(0).optional(),
  minGapMinutes: z.number().int().min(0).optional(),
});
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

// ---- Dashboard ----
export interface WhatsappDashboardStats {
  activeRules: number;
  sentToday: number;
  deliveredToday: number;
  readToday: number;
  failedToday: number;
  pending: number;
  scheduled: number;
  repliesToday: number;
  perRule: {
    ruleId: string;
    ruleName: string;
    status: "Active" | "Inactive";
    triggered: number;
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    replies: number;
  }[];
}

export const testSendSchema = z.object({
  phone: z.string().min(5, "Enter a phone number to test with"),
  overrides: z.record(z.string()).optional().default({}),
});
export type TestSend = z.infer<typeof testSendSchema>;

