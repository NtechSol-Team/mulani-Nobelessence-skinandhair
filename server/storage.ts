import {
  type Patient,
  type InsertPatient,
  type Visit,
  type InsertVisit,
  type Medicine,
  type InsertMedicine,
  type Treatment,
  type InsertTreatment,
  type Bill,
  type InsertBill,
  type Expense,
  type InsertExpense,
  type BillTreatmentItem,
  type BillMedicineItem,
  type Appointment,
  type InsertAppointment,
  type PaymentLedger,
  type InsertPaymentLedger,
  type Lead,
  type InsertLead,
  type CRMInteraction,
  type InsertCRMInteraction,
  type CRMTask,
  type InsertCRMTask,
  type Department,
  type InsertDepartment,
  type User,
  type RegisterInput,
  type WhatsappSettings,
  type UpdateSettings,
  type WhatsappTemplate,
  type WhatsappAutomationRule,
  type WhatsappAutomationRuleDetail,
  type WhatsappAutomationCondition,
  type WhatsappAutomationStep,
  type InsertRule,
  type StopConditionType,
  type WhatsappAutomationRun,
  type AutomationRunStatus,
  type WhatsappMessageJob,
  type MessageJobStatus,
  type MessageType,
  type WhatsappConversationSession,
  type WhatsappDashboardStats,
  type WhatsappEntityType,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { Pool, type PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
  // This cluster is a shared managed Postgres with a low max_connections.
  // Keep the pool small and let idle clients be reclaimed quickly.
  max: parseInt(process.env.PG_POOL_MAX || "8", 10),
  idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_MS || "10000", 10),
  connectionTimeoutMillis: 10000,
});

export interface IStorage {
  // Patients
  getPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  updatePatient(id: string, patient: InsertPatient): Promise<Patient | undefined>;
  deletePatient(id: string): Promise<boolean>;

  // Visits
  getVisits(): Promise<Visit[]>;
  getVisitsByPatient(patientId: string): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  updateVisit(id: string, visit: InsertVisit): Promise<Visit | undefined>;

  // Medicines
  getMedicines(): Promise<Medicine[]>;
  getMedicine(id: string): Promise<Medicine | undefined>;
  createMedicine(medicine: InsertMedicine): Promise<Medicine>;
  updateMedicine(id: string, medicine: InsertMedicine): Promise<Medicine | undefined>;
  deleteMedicine(id: string): Promise<boolean>;
  updateMedicineStock(id: string, quantity: number): Promise<Medicine | undefined>;

  // Treatments
  getTreatments(): Promise<Treatment[]>;
  getTreatment(id: string): Promise<Treatment | undefined>;
  createTreatment(treatment: InsertTreatment): Promise<Treatment>;
  updateTreatment(id: string, treatment: InsertTreatment): Promise<Treatment | undefined>;
  deleteTreatment(id: string): Promise<boolean>;

  // Departments
  getDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(department: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, department: InsertDepartment): Promise<Department | undefined>;
  deleteDepartment(id: string): Promise<boolean>;

  // Bills
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: InsertBill, patientName: string): Promise<Bill>;
  createBillWithStockUpdate(bill: InsertBill, patientName: string): Promise<Bill>;
  updateBill(id: string, bill: InsertBill, patientName: string): Promise<Bill | undefined>;
  updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined>;
  updatePatientBillsName(patientId: string, patientName: string): Promise<void>;
  deleteBill(id: string): Promise<boolean>;

  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: InsertExpense): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;

  // Appointments
  getAppointments(): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | undefined>;
  getAppointmentsByPatient(patientId: string): Promise<Appointment[]>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: InsertAppointment): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<boolean>;

  // Payment Ledger
  getPaymentLedgers(): Promise<PaymentLedger[]>;
  createPaymentLedgerEntry(payment: InsertPaymentLedger): Promise<PaymentLedger>;

  // CRM - Leads
  getLeads(): Promise<Lead[]>;
  getLead(id: string): Promise<Lead | undefined>;
  createLead(lead: InsertLead): Promise<Lead>;
  updateLead(id: string, lead: InsertLead): Promise<Lead | undefined>;
  deleteLead(id: string): Promise<boolean>;

  // CRM - Interactions
  getInteractions(patientId?: string, leadId?: string): Promise<CRMInteraction[]>;
  createInteraction(interaction: InsertCRMInteraction): Promise<CRMInteraction>;
  updateInteraction(id: string, update: Partial<InsertCRMInteraction>): Promise<CRMInteraction | undefined>;

  // CRM - Tasks
  getCRMTasks(): Promise<CRMTask[]>;
  createCRMTask(task: InsertCRMTask): Promise<CRMTask>;
  updateCRMTaskStatus(id: string, status: "Pending" | "Completed"): Promise<CRMTask | undefined>;
  deleteCRMTask(id: string): Promise<boolean>;
  ping(): Promise<boolean>;

  // Users/Auth
  getUsers(): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByUsernameRow(username: string): Promise<any | undefined>;
  createUser(user: RegisterInput): Promise<User>;
  updateUser(id: string, user: Partial<RegisterInput>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
}

type DbUserRow = {
  id: string | number;
  username: string;
  password: string;
  role: string;
  permissions?: any;
  created_at: string;
};

type DbPatientRow = {
  id: string | number;
  name: string;
  phone: string;
  registration_date: string;
  dob?: string;
  status?: string;
  source?: string;
  department?: string;
};

type DbLeadRow = {
  id: string | number;
  name: string;
  phone?: string;
  status: string;
  source: string;
  notes: string;
  created_at: string;
  converted_patient_id?: string | number;
};

type DbCRMInteractionRow = {
  id: string | number;
  patient_id?: string | number;
  lead_id?: string | number;
  date: string;
  type: string;
  channel: string;
  notes: string;
  outcome: string;
};

type DbCRMTaskRow = {
  id: string | number;
  description: string;
  patient_id?: string | number;
  patient_name?: string;
  lead_id?: string | number;
  lead_name?: string;
  due_date: string;
  status: string;
  priority: string;
};

type DbVisitRow = {
  id: string | number;
  patient_id: string | number;
  date: string;
  complaints: string;
  diagnosis: string;
  visit_number: number;
  prescription?: string;
  consumed_medicines?: any;
};

type DbMedicineRow = {
  id: string | number;
  name: string;
  purchase_cost: number;
  selling_price: number;
  quantity: number;
  type?: string;
  vendor_name?: string;
};

type DbTreatmentRow = {
  id: string | number;
  name: string;
  default_price: number;
  type?: string;
  equipments?: any;
};

type DbBillRow = {
  id: string | number;
  patient_id: string | number;
  patient_name: string;
  date: string;
  treatments: BillTreatmentItem[] | string;
  medicines: BillMedicineItem[] | string;
  treatment_total: number;
  medicine_total: number;
  grand_total: number;
  discount: number;
  discount_type?: string;
  final_amount: number;
  amount_paid: number;
  pending_amount: number;
};

type DbExpenseRow = {
  id: string | number;
  description: string;
  amount: number;
  date: string;
  category: string;
};

type DbAppointmentRow = {
  id: string | number;
  patient_id: string | number;
  patient_name?: string; // We might join this or fetch it separately
  date: string;
  time: string;
  reason: string;
  status: string;
  type?: string;
};

type DbPaymentLedgerRow = {
  id: string | number;
  bill_id: string | number;
  patient_id: string | number;
  amount: number;
  date: string;
  payment_mode: string;
};

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS patients (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    registration_date TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    complaints TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    visit_number INTEGER NOT NULL,
    prescription TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS visits_patient_idx ON visits(patient_id)`,
  `CREATE TABLE IF NOT EXISTS medicines (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    purchase_cost DOUBLE PRECISION NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL,
    quantity INTEGER NOT NULL,
    type TEXT DEFAULT 'Medicine',
    vendor_name TEXT DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    default_price DOUBLE PRECISION NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    date TEXT NOT NULL,
    treatments JSONB NOT NULL,
    medicines JSONB NOT NULL,
    treatment_total DOUBLE PRECISION NOT NULL,
    medicine_total DOUBLE PRECISION NOT NULL,
    grand_total DOUBLE PRECISION NOT NULL,
    discount DOUBLE PRECISION DEFAULT 0,
    final_amount DOUBLE PRECISION DEFAULT 0,
    amount_paid DOUBLE PRECISION NOT NULL,
    pending_amount DOUBLE PRECISION NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS bills_patient_idx ON bills(patient_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL,
    type TEXT DEFAULT 'New'
  )`,
  `CREATE INDEX IF NOT EXISTS appointments_patient_idx ON appointments(patient_id)`,
  `CREATE TABLE IF NOT EXISTS payment_ledger (
    id UUID PRIMARY KEY,
    bill_id UUID REFERENCES bills(id) ON DELETE CASCADE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL,
    payment_mode TEXT NOT NULL DEFAULT 'Cash'
  )`,
  `CREATE INDEX IF NOT EXISTS payment_ledger_date_idx ON payment_ledger(date)`,
  `CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT,
    status TEXT NOT NULL DEFAULT 'New',
    source TEXT NOT NULL DEFAULT 'Instagram',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    converted_patient_id UUID REFERENCES patients(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS crm_interactions (
    id UUID PRIMARY KEY,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    type TEXT NOT NULL,
    channel TEXT NOT NULL,
    notes TEXT NOT NULL,
    outcome TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS crm_interactions_patient_idx ON crm_interactions(patient_id)`,
  `CREATE INDEX IF NOT EXISTS crm_interactions_lead_idx ON crm_interactions(lead_id)`,
  `CREATE TABLE IF NOT EXISTS crm_tasks (
    id UUID PRIMARY KEY,
    description TEXT NOT NULL,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    priority TEXT NOT NULL DEFAULT 'Medium'
  )`,
  `CREATE INDEX IF NOT EXISTS crm_tasks_patient_idx ON crm_tasks(patient_id)`,
  `CREATE INDEX IF NOT EXISTS crm_tasks_lead_idx ON crm_tasks(lead_id)`,
  `CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Staff',
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // ==================== WHATSAPP AUTOMATION ====================
  `CREATE TABLE IF NOT EXISTS whatsapp_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    enabled BOOLEAN NOT NULL DEFAULT true,
    business_hours_enabled BOOLEAN NOT NULL DEFAULT true,
    business_hours_start TEXT NOT NULL DEFAULT '09:00',
    business_hours_end TEXT NOT NULL DEFAULT '20:00',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    max_per_contact_per_day INTEGER NOT NULL DEFAULT 3,
    min_gap_minutes INTEGER NOT NULL DEFAULT 30,
    CONSTRAINT whatsapp_settings_singleton CHECK (id = 1)
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_templates (
    template_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    category TEXT NOT NULL DEFAULT 'UTILITY',
    status TEXT NOT NULL DEFAULT 'DRAFT',
    header_type TEXT DEFAULT '',
    header_text TEXT DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    footer TEXT DEFAULT '',
    variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_rules (
    id UUID PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'Inactive',
    priority TEXT NOT NULL DEFAULT 'Normal',
    trigger_type TEXT NOT NULL,
    trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    target_audience TEXT NOT NULL DEFAULT 'primary_entity',
    custom_phone TEXT NOT NULL DEFAULT '',
    business_hours_only BOOLEAN NOT NULL DEFAULT true,
    max_per_contact_per_day INTEGER NOT NULL DEFAULT 0,
    created_by TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_rules_trigger_idx ON whatsapp_automation_rules(trigger_type, status)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_conditions (
    id UUID PRIMARY KEY,
    rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE CASCADE,
    field TEXT NOT NULL,
    operator TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    group_no INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_conditions_rule_idx ON whatsapp_automation_conditions(rule_id)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_steps (
    id UUID PRIMARY KEY,
    rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL DEFAULT 0,
    delay_type TEXT NOT NULL DEFAULT 'immediate',
    delay_unit TEXT NOT NULL DEFAULT 'hours',
    delay_value INTEGER NOT NULL DEFAULT 0,
    specific_time TEXT NOT NULL DEFAULT '',
    template_id TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT 'auto',
    variable_mapping JSONB NOT NULL DEFAULT '{}'::jsonb
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_steps_rule_idx ON whatsapp_automation_steps(rule_id)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_stop_conditions (
    id UUID PRIMARY KEY,
    rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE CASCADE,
    type TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_stop_conditions_rule_idx ON whatsapp_automation_stop_conditions(rule_id)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_runs (
    id UUID PRIMARY KEY,
    rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    trigger_event TEXT NOT NULL,
    current_step INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    stop_reason TEXT NOT NULL DEFAULT '',
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(rule_id, entity_type, entity_id, trigger_event)
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_runs_entity_idx ON whatsapp_automation_runs(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS whatsapp_runs_status_idx ON whatsapp_automation_runs(status)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_message_jobs (
    id UUID PRIMARY KEY,
    run_id UUID REFERENCES whatsapp_automation_runs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES whatsapp_automation_steps(id) ON DELETE SET NULL,
    rule_id UUID REFERENCES whatsapp_automation_rules(id) ON DELETE SET NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    phone TEXT NOT NULL,
    template_id TEXT NOT NULL DEFAULT '',
    message_type TEXT NOT NULL DEFAULT 'template',
    variables JSONB NOT NULL DEFAULT '{}'::jsonb,
    rendered_preview TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    provider_message_id TEXT,
    campaign_id TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_jobs_status_idx ON whatsapp_message_jobs(status, scheduled_at)`,
  `CREATE INDEX IF NOT EXISTS whatsapp_jobs_entity_idx ON whatsapp_message_jobs(entity_type, entity_id)`,
  `CREATE INDEX IF NOT EXISTS whatsapp_jobs_phone_idx ON whatsapp_message_jobs(phone)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_conversation_sessions (
    phone TEXT PRIMARY KEY,
    last_inbound_at TIMESTAMPTZ,
    last_outbound_at TIMESTAMPTZ,
    window_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'closed'
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_opt_outs (
    phone TEXT PRIMARY KEY,
    opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS whatsapp_automation_audit_log (
    id UUID PRIMARY KEY,
    action TEXT NOT NULL,
    rule_id UUID,
    user_id TEXT DEFAULT '',
    username TEXT DEFAULT '',
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS whatsapp_audit_rule_idx ON whatsapp_automation_audit_log(rule_id)`,
  `CREATE TABLE IF NOT EXISTS whatsapp_webhook_events (
    id UUID PRIMARY KEY,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    note TEXT DEFAULT '',
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

async function ensureTables(): Promise<void> {
  for (const statement of createTableStatements) {
    await pool.query(statement);
  }
  // Migration for new time column
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time TEXT DEFAULT ''");

  // Migration for Appointment type
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'New'");

  // Migration for Medicine type
  await pool.query("ALTER TABLE medicines ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Medicine'");

  // Migration for Medicine vendor_name
  await pool.query("ALTER TABLE medicines ADD COLUMN IF NOT EXISTS vendor_name TEXT DEFAULT ''");

  // Migration for Treatment type and equipments
  await pool.query("ALTER TABLE treatments ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'General'");
  await pool.query("ALTER TABLE treatments ADD COLUMN IF NOT EXISTS equipments JSONB DEFAULT '[]'::jsonb");

  // Migration for Patient CRM fields
  await pool.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob TEXT DEFAULT ''");
  await pool.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active'");
  await pool.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'Walk-in'");
  await pool.query("ALTER TABLE patients ADD COLUMN IF NOT EXISTS department TEXT DEFAULT ''");

  // Create departments table
  await pool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    )
  `);

  // Pre-seed departments table
  const { rowCount: deptCount } = await pool.query("SELECT 1 FROM departments LIMIT 1");
  if (!deptCount) {
    await pool.query("INSERT INTO departments (id, name) VALUES ($1, 'Hair'), ($2, 'Skin')", [randomUUID(), randomUUID()]);
  }

  // Migration to make lead phone optional
  await pool.query("ALTER TABLE leads ALTER COLUMN phone DROP NOT NULL");

  // Migration for discount fields
  await pool.query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount DOUBLE PRECISION DEFAULT 0");
  await pool.query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS final_amount DOUBLE PRECISION DEFAULT 0");
  await pool.query("ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_type TEXT DEFAULT 'Percentage'");

  // Backfill final_amount for existing records if it's 0 but grand_total is not (optional but good for consistency)
  // We can assume if final_amount is 0 and discount is 0, final_amount should match grand_total.
  await pool.query("UPDATE bills SET final_amount = grand_total WHERE final_amount = 0 AND discount = 0 AND grand_total > 0");

  // Migration for payment_mode
  await pool.query("ALTER TABLE payment_ledger ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'Cash'");

  // Migration for prescription column in visits
  await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS prescription TEXT DEFAULT ''");

  // Migration for consumed_medicines column in visits
  await pool.query("ALTER TABLE visits ADD COLUMN IF NOT EXISTS consumed_medicines JSONB DEFAULT '[]'::jsonb");

  // Backfill payment_ledger
  const { rowCount } = await pool.query("SELECT 1 FROM payment_ledger LIMIT 1");
  if (!rowCount) {
    try {
      await pool.query(`
        INSERT INTO payment_ledger (id, bill_id, patient_id, amount, date, payment_mode)
        SELECT gen_random_uuid(), id, patient_id, amount_paid, date, 'Cash'
        FROM bills
        WHERE amount_paid > 0
      `);
    } catch (e) {
      console.error("Error backfilling payment_ledger:", e);
    }
  }

  await ensureWhatsappDefaults();
}

async function ensureWhatsappDefaults(): Promise<void> {
  // Seed the single settings row.
  await pool.query(
    `INSERT INTO whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`
  );

  // Seed a handful of representative starter rules (spec section 24), left
  // Inactive since they reference placeholder template names the clinic
  // hasn't created/approved yet. Idempotent: only runs if no rules exist.
  const { rowCount } = await pool.query("SELECT 1 FROM whatsapp_automation_rules LIMIT 1");
  if (rowCount) return;

  type StarterStep = {
    delayType: string; delayUnit?: string; delayValue?: number; specificTime?: string;
    templateId: string; messageType?: string; variableMapping?: Record<string, string>;
  };
  type StarterRule = {
    name: string; description: string; priority: string; triggerType: string;
    triggerConfig?: Record<string, any>;
    steps: StarterStep[];
    stopConditions?: string[];
  };

  const starters: StarterRule[] = [
    {
      name: "New Lead Welcome",
      description: "Sends an immediate WhatsApp welcome the moment a new lead is added to the CRM.",
      priority: "High",
      triggerType: "lead_created",
      steps: [{ delayType: "immediate", templateId: "new_lead_welcome", variableMapping: { name: "lead.name" } }],
      stopConditions: ["lead_replied", "lead_converted", "lead_lost", "opted_out"],
    },
    {
      name: "Lead Follow-up (Day 1)",
      description: "One day after a lead is created, follow up if they haven't booked an appointment yet.",
      priority: "Normal",
      triggerType: "lead_created",
      steps: [{ delayType: "after", delayUnit: "days", delayValue: 1, templateId: "lead_followup_1", variableMapping: { name: "lead.name" } }],
      stopConditions: ["lead_replied", "appointment_booked", "lead_converted", "lead_lost", "opted_out"],
    },
    {
      name: "Appointment Confirmation",
      description: "Confirms the appointment immediately after it is booked.",
      priority: "High",
      triggerType: "appointment_booked",
      steps: [{ delayType: "immediate", templateId: "appointment_confirmation", variableMapping: { name: "patient.name", date: "appointment.date", time: "appointment.time" } }],
      stopConditions: ["opted_out"],
    },
    {
      name: "Appointment Reminder (24h Before)",
      description: "Reminds the patient 24 hours before their scheduled appointment.",
      priority: "High",
      triggerType: "appointment_reminder",
      steps: [{ delayType: "after", delayUnit: "days", delayValue: 1, templateId: "appointment_reminder", variableMapping: { name: "patient.name", date: "appointment.date", time: "appointment.time" } }],
      stopConditions: ["opted_out"],
    },
    {
      name: "Post-Appointment Feedback",
      description: "Asks for feedback two hours after an appointment is marked Completed.",
      priority: "Normal",
      triggerType: "appointment_completed",
      steps: [{ delayType: "after", delayUnit: "hours", delayValue: 2, templateId: "post_appointment_feedback", variableMapping: { name: "patient.name" } }],
      stopConditions: ["opted_out"],
    },
  ];

  // Atomic: a mid-loop failure (e.g. a transient connection hiccup) must
  // never leave a partially-seeded, inconsistent set of example rules behind.
  await withTransaction(async (client) => {
    for (const starter of starters) {
      const ruleId = randomUUID();
      await client.query(
        `INSERT INTO whatsapp_automation_rules
          (id, name, description, status, priority, trigger_type, trigger_config, target_audience, custom_phone, business_hours_only, max_per_contact_per_day, created_by)
         VALUES ($1, $2, $3, 'Inactive', $4, $5, $6, 'primary_entity', '', true, 0, 'system')`,
        [ruleId, starter.name, starter.description, starter.priority, starter.triggerType, JSON.stringify(starter.triggerConfig || {})]
      );
      for (let i = 0; i < starter.steps.length; i++) {
        const s = starter.steps[i];
        await client.query(
          `INSERT INTO whatsapp_automation_steps
            (id, rule_id, step_order, delay_type, delay_unit, delay_value, specific_time, template_id, message_type, variable_mapping)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [randomUUID(), ruleId, i, s.delayType, s.delayUnit || "hours", s.delayValue || 0, s.specificTime || "", s.templateId, s.messageType || "auto", JSON.stringify(s.variableMapping || {})]
        );
      }
      for (const stopType of starter.stopConditions || []) {
        await client.query(
          `INSERT INTO whatsapp_automation_stop_conditions (id, rule_id, type) VALUES ($1, $2, $3)`,
          [randomUUID(), ruleId, stopType]
        );
      }
    }
  });
}

class DataCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  constructor(private ttlMs: number) { }

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expires) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, { value, expires: Date.now() + this.ttlMs });
  }

  invalidate(prefix?: string): void {
    if (!prefix) {
      this.store.clear();
      return;
    }
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

type EntityTable = "patients" | "visits" | "medicines" | "treatments" | "bills" | "expenses" | "appointments" | "payment_ledger" | "leads" | "crm_interactions" | "crm_tasks" | "departments" | "users";
type IdMode = "numeric" | "text";

async function getColumnDataType(table: string, column: string): Promise<string | undefined> {
  const { rows } = await pool.query<{ data_type: string }>(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows[0]?.data_type;
}

async function detectIdModes(): Promise<Record<EntityTable, IdMode>> {
  const tables: EntityTable[] = ["patients", "visits", "medicines", "treatments", "bills", "expenses", "appointments", "payment_ledger", "leads", "crm_interactions", "crm_tasks", "departments", "users"];
  const entries = await Promise.all(
    tables.map(async (table) => {
      const dataType = await getColumnDataType(table, "id");
      const mode: IdMode = dataType === "bigint" || dataType === "integer" ? "numeric" : "text";
      return [table, mode] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<EntityTable, IdMode>;
}

const normalizeId = (value: string | number): string => value.toString();

const mapUser = (row: DbUserRow): User => ({
  id: normalizeId(row.id),
  username: row.username,
  role: (row.role || "Staff") as "SuperAdmin" | "Staff",
  permissions: row.permissions || {},
  createdAt: row.created_at,
});

const mapPatient = (row: DbPatientRow): Patient => ({
  id: normalizeId(row.id),
  name: row.name,
  phone: row.phone,
  registrationDate: row.registration_date,
  dob: row.dob || "",
  status: (row.status || "Active") as "Active" | "Inactive" | "VIP",
  source: row.source || "Walk-in",
  department: row.department || "",
});

const mapLead = (row: DbLeadRow): Lead => ({
  id: normalizeId(row.id),
  name: row.name,
  phone: row.phone,
  status: (row.status || "New") as any,
  source: row.source || "Instagram",
  notes: row.notes || "",
  createdAt: row.created_at,
  convertedPatientId: row.converted_patient_id ? normalizeId(row.converted_patient_id) : undefined,
});

const mapCRMInteraction = (row: DbCRMInteractionRow): CRMInteraction => ({
  id: normalizeId(row.id),
  patientId: row.patient_id ? normalizeId(row.patient_id) : undefined,
  leadId: row.lead_id ? normalizeId(row.lead_id) : undefined,
  date: row.date,
  type: (row.type || "Inquiry") as any,
  channel: (row.channel || "Call") as any,
  notes: row.notes || "",
  outcome: row.outcome || "",
});

const mapCRMTask = (row: DbCRMTaskRow): CRMTask => ({
  id: normalizeId(row.id),
  description: row.description,
  patientId: row.patient_id ? normalizeId(row.patient_id) : undefined,
  patientName: row.patient_name,
  leadId: row.lead_id ? normalizeId(row.lead_id) : undefined,
  leadName: row.lead_name,
  dueDate: row.due_date,
  status: (row.status || "Pending") as any,
  priority: (row.priority || "Medium") as any,
});

const mapVisit = (row: DbVisitRow): Visit => {
  let consumedMedicines = row.consumed_medicines ?? [];
  if (typeof consumedMedicines === "string") {
    try {
      consumedMedicines = JSON.parse(consumedMedicines);
    } catch (e) {
      consumedMedicines = [];
    }
  }
  return {
    id: normalizeId(row.id),
    patientId: normalizeId(row.patient_id),
    date: row.date,
    complaints: row.complaints,
    diagnosis: row.diagnosis,
    visitNumber: row.visit_number,
    prescription: row.prescription || "",
    consumedMedicines: consumedMedicines as any[],
  };
};

const mapMedicine = (row: DbMedicineRow): Medicine => ({
  id: normalizeId(row.id),
  name: row.name,
  purchaseCost: row.purchase_cost,
  sellingPrice: row.selling_price,
  quantity: row.quantity,
  type: (row.type || "Medicine") as "Medicine" | "Equipment",
  vendorName: row.vendor_name || "",
});

const mapTreatment = (row: DbTreatmentRow): Treatment => {
  let equipments = row.equipments ?? [];
  if (typeof equipments === "string") {
    try {
      equipments = JSON.parse(equipments);
    } catch (e) {
      equipments = [];
    }
  }
  return {
    id: normalizeId(row.id),
    name: row.name,
    defaultPrice: row.default_price,
    type: (row.type || "General") as "General" | "Surgery",
    equipments: equipments as any[],
  };
};

const mapBill = (row: DbBillRow): Bill => {
  // Parse medicines if it's a string (stored as JSON in DB)
  let medicines = row.medicines ?? [];
  if (typeof medicines === "string") {
    try {
      medicines = JSON.parse(medicines);
    } catch (e) {
      medicines = [];
    }
  }

  // Parse treatments if it's a string (stored as JSON in DB)
  let treatments = row.treatments ?? [];
  if (typeof treatments === "string") {
    try {
      treatments = JSON.parse(treatments);
    } catch (e) {
      treatments = [];
    }
  }

  // Properly handle finalAmount - only fallback to grand_total if finalAmount is truly null/undefined
  const finalAmount = row.final_amount !== null && row.final_amount !== undefined
    ? row.final_amount
    : row.grand_total;

  return {
    id: normalizeId(row.id),
    patientId: normalizeId(row.patient_id),
    patientName: row.patient_name,
    date: row.date,
    treatments: treatments as BillTreatmentItem[],
    medicines: medicines as BillMedicineItem[],
    treatmentTotal: row.treatment_total,
    medicineTotal: row.medicine_total,
    grandTotal: row.grand_total,
    discount: row.discount || 0,
    discountType: (row.discount_type || "Percentage") as "Percentage" | "INR",
    finalAmount: finalAmount,
    amountPaid: row.amount_paid,
    pendingAmount: row.pending_amount,
  };
};

const mapExpense = (row: DbExpenseRow): Expense => ({
  id: normalizeId(row.id),
  description: row.description,
  amount: row.amount,
  date: row.date,
  category: row.category,
});

const mapAppointment = (row: DbAppointmentRow): Appointment => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  patientName: row.patient_name,
  date: row.date,
  time: row.time || "09:00", // Default for legacy data
  reason: row.reason,
  status: row.status,
  isUpcoming: new Date(row.date) >= new Date(new Date().setHours(0, 0, 0, 0)),
  type: (row.type || "New") as "New" | "Follow-up",
});

const mapPaymentLedger = (row: DbPaymentLedgerRow): PaymentLedger => ({
  id: normalizeId(row.id),
  billId: normalizeId(row.bill_id),
  patientId: normalizeId(row.patient_id),
  amount: row.amount,
  date: row.date,
  paymentMode: (row.payment_mode || "Cash") as "Cash" | "Online",
});

// ==================== WHATSAPP AUTOMATION: row types & mappers ====================

function parseJsonColumn<T>(value: any, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

const mapSettings = (row: any): WhatsappSettings => ({
  enabled: !!row.enabled,
  businessHoursEnabled: !!row.business_hours_enabled,
  businessHoursStart: row.business_hours_start,
  businessHoursEnd: row.business_hours_end,
  timezone: row.timezone,
  maxPerContactPerDay: row.max_per_contact_per_day,
  minGapMinutes: row.min_gap_minutes,
});

const mapWhatsappTemplate = (row: any): WhatsappTemplate => ({
  templateId: row.template_id,
  name: row.name,
  language: row.language,
  category: row.category,
  status: row.status,
  headerType: row.header_type || "",
  headerText: row.header_text || "",
  body: row.body || "",
  footer: row.footer || "",
  variables: parseJsonColumn(row.variables, []),
  buttons: parseJsonColumn(row.buttons, []),
  lastSyncedAt: row.last_synced_at,
});

const mapRule = (row: any): WhatsappAutomationRule => ({
  id: normalizeId(row.id),
  name: row.name,
  description: row.description || "",
  status: row.status,
  priority: row.priority,
  triggerType: row.trigger_type,
  triggerConfig: parseJsonColumn(row.trigger_config, {}),
  targetAudience: row.target_audience,
  customPhone: row.custom_phone || "",
  businessHoursOnly: !!row.business_hours_only,
  maxPerContactPerDay: row.max_per_contact_per_day || 0,
  createdBy: row.created_by || "",
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapCondition = (row: any): WhatsappAutomationCondition => ({
  id: normalizeId(row.id),
  ruleId: normalizeId(row.rule_id),
  field: row.field,
  operator: row.operator,
  value: row.value || "",
  groupNo: row.group_no || 0,
});

const mapStep = (row: any): WhatsappAutomationStep => ({
  id: normalizeId(row.id),
  ruleId: normalizeId(row.rule_id),
  stepOrder: row.step_order,
  delayType: row.delay_type,
  delayUnit: row.delay_unit,
  delayValue: row.delay_value,
  specificTime: row.specific_time || "",
  templateId: row.template_id || "",
  messageType: row.message_type,
  variableMapping: parseJsonColumn(row.variable_mapping, {}),
});

const mapRun = (row: any): WhatsappAutomationRun => ({
  id: normalizeId(row.id),
  ruleId: normalizeId(row.rule_id),
  ruleName: row.rule_name,
  entityType: row.entity_type,
  entityId: normalizeId(row.entity_id),
  entityName: row.entity_name,
  triggerEvent: row.trigger_event,
  currentStep: row.current_step,
  status: row.status,
  stopReason: row.stop_reason || "",
  startedAt: row.started_at,
  updatedAt: row.updated_at,
});

const mapJob = (row: any): WhatsappMessageJob => ({
  id: normalizeId(row.id),
  runId: normalizeId(row.run_id),
  stepId: row.step_id ? normalizeId(row.step_id) : "",
  ruleId: row.rule_id ? normalizeId(row.rule_id) : "",
  ruleName: row.rule_name,
  entityType: row.entity_type,
  entityId: normalizeId(row.entity_id),
  entityName: row.entity_name,
  phone: row.phone,
  templateId: row.template_id || "",
  templateName: row.template_name,
  messageType: row.message_type,
  variables: parseJsonColumn(row.variables, {}),
  renderedPreview: row.rendered_preview || "",
  status: row.status,
  scheduledAt: row.scheduled_at,
  sentAt: row.sent_at || undefined,
  deliveredAt: row.delivered_at || undefined,
  readAt: row.read_at || undefined,
  providerMessageId: row.provider_message_id || undefined,
  campaignId: row.campaign_id || undefined,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  lastError: row.last_error || undefined,
});

const mapConversationSession = (row: any): WhatsappConversationSession => ({
  phone: row.phone,
  lastInboundAt: row.last_inbound_at || undefined,
  lastOutboundAt: row.last_outbound_at || undefined,
  windowExpiresAt: row.window_expires_at || undefined,
  status: row.status,
});

async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export class PostgresStorage implements IStorage {
  private ready: Promise<void>;
  private idModes: Record<EntityTable, IdMode> = {
    patients: "text",
    visits: "text",
    medicines: "text",
    treatments: "text",
    bills: "text",
    expenses: "text",
    appointments: "text",
    payment_ledger: "text",
    leads: "text",
    crm_interactions: "text",
    crm_tasks: "text",
    departments: "text",
    users: "text",
  };
  private cache = new DataCache(5_000);

  constructor() {
    this.ready = (async () => {
      await ensureTables();
      this.idModes = await detectIdModes();
    })();
  }

  private async waitForReady() {
    await this.ready;
  }

  private usesNumericId(table: EntityTable): boolean {
    switch (table) {
      case "patients":
        return this.idModes.patients === "numeric";
      case "visits":
        return this.idModes.visits === "numeric";
      case "medicines":
        return this.idModes.medicines === "numeric";
      case "treatments":
        return this.idModes.treatments === "numeric";
      case "bills":
        return this.idModes.bills === "numeric";
      case "expenses":
        return this.idModes.expenses === "numeric";
      case "appointments":
        return this.idModes.appointments === "numeric";
      case "payment_ledger":
        return this.idModes.payment_ledger === "numeric";
      case "leads":
        return this.idModes.leads === "numeric";
      case "crm_interactions":
        return this.idModes.crm_interactions === "numeric";
      case "crm_tasks":
        return this.idModes.crm_tasks === "numeric";
      case "users":
        return this.idModes.users === "numeric";
      default:
        return false;
    }
  }

  private convertId(table: EntityTable, id: string): string | number {
    if (!this.usesNumericId(table)) {
      return id;
    }
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) {
      throw new Error(`Invalid ${table} id: ${id}`);
    }
    return numericId;
  }

  // Patients
  async getPatients(): Promise<Patient[]> {
    await this.waitForReady();
    const cached = this.cache.get<Patient[]>("patients");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbPatientRow>(
      "SELECT id, name, phone, registration_date, dob, status, source, department FROM patients ORDER BY registration_date DESC"
    );
    const patients = rows.map(mapPatient);
    this.cache.set("patients", patients);
    return patients;
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `patient:${normalizedId}`;
    const cached = this.cache.get<Patient>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("patients", id);
    const { rows } = await pool.query<DbPatientRow>(
      "SELECT id, name, phone, registration_date, dob, status, source, department FROM patients WHERE id = $1",
      [dbId]
    );
    const patient = rows[0] ? mapPatient(rows[0]) : undefined;
    if (patient) {
      this.cache.set(cacheKey, patient);
    }
    return patient;
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("patients");
    const query = useNumericId
      ? `INSERT INTO patients (name, phone, registration_date, dob, status, source, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, phone, registration_date, dob, status, source, department`
      : `INSERT INTO patients (id, name, phone, registration_date, dob, status, source, department)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, phone, registration_date, dob, status, source, department`;
    const params = useNumericId
      ? [insertPatient.name, insertPatient.phone, insertPatient.registrationDate, insertPatient.dob || '', insertPatient.status || 'Active', insertPatient.source || 'Walk-in', insertPatient.department || '']
      : [randomUUID(), insertPatient.name, insertPatient.phone, insertPatient.registrationDate, insertPatient.dob || '', insertPatient.status || 'Active', insertPatient.source || 'Walk-in', insertPatient.department || ''];
    const { rows } = await pool.query<DbPatientRow>(query, params);
    const patient = mapPatient(rows[0]);
    this.cache.invalidate("patients");
    this.cache.invalidate("patient:");
    return patient;
  }

  async updatePatient(id: string, insertPatient: InsertPatient): Promise<Patient | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query<DbPatientRow>(
      `UPDATE patients
       SET name = $1, phone = $2, registration_date = $3, dob = $4, status = $5, source = $6, department = $7
       WHERE id = $8
       RETURNING id, name, phone, registration_date, dob, status, source, department`,
      [insertPatient.name, insertPatient.phone, insertPatient.registrationDate, insertPatient.dob || '', insertPatient.status || 'Active', insertPatient.source || 'Walk-in', insertPatient.department || '', id]
    );
    const patient = rows[0] ? mapPatient(rows[0]) : undefined;
    if (patient) {
      this.cache.invalidate("patients");
      this.cache.invalidate("patient:");
    }
    return patient;
  }

  async deletePatient(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("patients", id);

    // 1. Get all bills for this patient to restore medicine stock
    const { rows: patientBills } = await pool.query<DbBillRow>(
      "SELECT * FROM bills WHERE patient_id = $1",
      [dbId]
    );

    // 2. Restore stock for each bill
    for (const row of patientBills) {
      const bill = mapBill(row);
      for (const med of bill.medicines) {
        if (med.medicineId && med.quantity > 0) {
          try {
            await this.updateMedicineStock(med.medicineId, med.quantity);
          } catch (e) {
            console.error(`Failed to restore stock for medicine ${med.medicineId} in bill ${bill.id}`, e);
          }
        }
      }
    }

    // 2.5 Restore stock for consumed medicines in visits
    const { rows: patientVisits } = await pool.query<DbVisitRow>(
      "SELECT * FROM visits WHERE patient_id = $1",
      [dbId]
    );
    for (const row of patientVisits) {
      const visit = mapVisit(row);
      const consumed = visit.consumedMedicines || [];
      for (const item of consumed) {
        if (item.medicineId && item.quantity > 0) {
          try {
            await this.updateMedicineStock(item.medicineId, item.quantity);
          } catch (e) {
            console.error(`Failed to restore stock for consumed medicine ${item.medicineId} in visit ${visit.id}`, e);
          }
        }
      }
    }

    // 3. Delete patient (Cascade will delete bills and visits)
    const result = await pool.query("DELETE FROM patients WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;

    if (success) {
      this.cache.invalidate("patients");
      this.cache.invalidate(`patient:${normalizeId(id)}`);
      this.cache.invalidate("bills");
      this.cache.invalidate("medicines");
      this.cache.invalidate("visits");
    }

    return success;
  }

  // Visits
  async getVisits(): Promise<Visit[]> {
    await this.waitForReady();
    const cached = this.cache.get<Visit[]>("visits:all");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbVisitRow>(
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines FROM visits ORDER BY date DESC, visit_number DESC"
    );
    const visits = rows.map(mapVisit);
    this.cache.set("visits:all", visits);
    return visits;
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    await this.waitForReady();
    const normalizedPatientId = normalizeId(patientId);
    const cacheKey = `visits:patient:${normalizedPatientId}`;
    const cached = this.cache.get<Visit[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbVisitRow>(
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines FROM visits WHERE patient_id = $1 ORDER BY visit_number DESC",
      [dbPatientId]
    );
    const visits = rows.map(mapVisit);
    this.cache.set(cacheKey, visits);
    return visits;
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    await this.waitForReady();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Deduct stock for consumed medicines
      const consumedMedicines = insertVisit.consumedMedicines || [];
      for (const item of consumedMedicines) {
        if (item.medicineId) {
          const dbMedId = this.convertId("medicines", item.medicineId);
          await client.query(
            "UPDATE medicines SET quantity = GREATEST(0, quantity - $2) WHERE id = $1",
            [dbMedId, item.quantity]
          );
        }
      }

      // 2. Get visit number
      const patientIdValue = this.convertId("patients", insertVisit.patientId);
      const [{ visit_number }] = (
        await client.query<{ visit_number: number }>(
          `SELECT COALESCE(MAX(visit_number), 0) + 1 AS visit_number
           FROM visits
           WHERE patient_id = $1`,
          [patientIdValue]
        )
      ).rows;

      const visitNumber = Number(visit_number ?? 1);
      const usesNumericVisitId = this.usesNumericId("visits");
      const insertQuery = usesNumericVisitId
        ? `INSERT INTO visits(patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines)
           VALUES($1, $2, $3, $4, $5, $6, $7)
           RETURNING id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines`
        : `INSERT INTO visits(id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines)
           VALUES($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines`;
      const insertParams = usesNumericVisitId
        ? [patientIdValue, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis, visitNumber, insertVisit.prescription || "", JSON.stringify(consumedMedicines)]
        : [
          randomUUID(),
          patientIdValue,
          insertVisit.date,
          insertVisit.complaints,
          insertVisit.diagnosis,
          visitNumber,
          insertVisit.prescription || "",
          JSON.stringify(consumedMedicines),
        ];

      const { rows } = await client.query<DbVisitRow>(insertQuery, insertParams);
      await client.query("COMMIT");

      const visit = mapVisit(rows[0]);
      this.cache.invalidate("visits");
      this.cache.invalidate(`visits:patient:${normalizeId(insertVisit.patientId)}`);
      this.cache.invalidate("medicines"); // because stock changed
      return visit;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async updateVisit(id: string, insertVisit: InsertVisit): Promise<Visit | undefined> {
    await this.waitForReady();
    const dbVisitId = this.convertId("visits", id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Get old visit to see what was previously consumed
      const { rows: oldRows } = await client.query<DbVisitRow>(
        "SELECT * FROM visits WHERE id = $1 FOR UPDATE",
        [dbVisitId]
      );
      const oldVisitRow = oldRows[0];
      if (!oldVisitRow) {
        await client.query("ROLLBACK");
        return undefined;
      }
      const oldVisit = mapVisit(oldVisitRow);
      const oldConsumed = oldVisit.consumedMedicines || [];

      // 2. Restore old stock
      for (const item of oldConsumed) {
        if (item.medicineId) {
          const dbMedId = this.convertId("medicines", item.medicineId);
          await client.query(
            "UPDATE medicines SET quantity = quantity + $2 WHERE id = $1",
            [dbMedId, item.quantity]
          );
        }
      }

      // 3. Deduct new stock
      const newConsumed = insertVisit.consumedMedicines || [];
      for (const item of newConsumed) {
        if (item.medicineId) {
          const dbMedId = this.convertId("medicines", item.medicineId);
          await client.query(
            "UPDATE medicines SET quantity = GREATEST(0, quantity - $2) WHERE id = $1",
            [dbMedId, item.quantity]
          );
        }
      }

      // 4. Update the visit row
      const { rows } = await client.query<DbVisitRow>(
        `UPDATE visits
         SET date = $2,
              complaints = $3,
              diagnosis = $4,
              prescription = $5,
              consumed_medicines = $6
         WHERE id = $1
         RETURNING id, patient_id, date, complaints, diagnosis, visit_number, prescription, consumed_medicines`,
        [dbVisitId, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis, insertVisit.prescription || "", JSON.stringify(newConsumed)]
      );
      await client.query("COMMIT");

      const visit = rows[0] ? mapVisit(rows[0]) : undefined;
      if (visit) {
        this.cache.invalidate("visits");
        this.cache.invalidate(`visits:patient:${visit.patientId}`);
        this.cache.invalidate("medicines"); // because stock changed
      }
      return visit;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  // Medicines
  async getMedicines(): Promise<Medicine[]> {
    await this.waitForReady();
    const cached = this.cache.get<Medicine[]>("medicines");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbMedicineRow>(
      "SELECT id, name, purchase_cost, selling_price, quantity, type, vendor_name FROM medicines ORDER BY name ASC"
    );
    const medicines = rows.map(mapMedicine);
    this.cache.set("medicines", medicines);
    return medicines;
  }

  async getMedicine(id: string): Promise<Medicine | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `medicine:${normalizedId} `;
    const cached = this.cache.get<Medicine>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      "SELECT id, name, purchase_cost, selling_price, quantity, type, vendor_name FROM medicines WHERE id = $1",
      [dbId]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.set(cacheKey, medicine);
    }
    return medicine;
  }

  async createMedicine(insertMedicine: InsertMedicine): Promise<Medicine> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("medicines");
    const query = useNumericId
      ? `INSERT INTO medicines(name, purchase_cost, selling_price, quantity, type, vendor_name)
          VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, name, purchase_cost, selling_price, quantity, type, vendor_name`
      : `INSERT INTO medicines(id, name, purchase_cost, selling_price, quantity, type, vendor_name)
          VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, purchase_cost, selling_price, quantity, type, vendor_name`;
    const params = useNumericId
      ? [insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity, insertMedicine.type || 'Medicine', insertMedicine.vendorName || '']
      : [
        randomUUID(),
        insertMedicine.name,
        insertMedicine.purchaseCost,
        insertMedicine.sellingPrice,
        insertMedicine.quantity,
        insertMedicine.type || 'Medicine',
        insertMedicine.vendorName || '',
      ];
    const { rows } = await pool.query<DbMedicineRow>(query, params);
    const medicine = mapMedicine(rows[0]);
    this.cache.invalidate("medicines");
    this.cache.invalidate("medicine:");
    return medicine;
  }

  async updateMedicine(id: string, insertMedicine: InsertMedicine): Promise<Medicine | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      `UPDATE medicines
       SET name = $2,
            purchase_cost = $3,
            selling_price = $4,
            quantity = $5,
            type = $6,
            vendor_name = $7
       WHERE id = $1
       RETURNING id, name, purchase_cost, selling_price, quantity, type, vendor_name`,
      [dbId, insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity, insertMedicine.type || 'Medicine', insertMedicine.vendorName || '']
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id} `);
    }
    return medicine;
  }

  async deleteMedicine(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const result = await pool.query("DELETE FROM medicines WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${normalizeId(id)} `);
    }
    return success;
  }

  async updateMedicineStock(id: string, quantityChange: number): Promise<Medicine | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      `UPDATE medicines
       SET quantity = GREATEST(0, quantity + $2)
       WHERE id = $1
       RETURNING id, name, purchase_cost, selling_price, quantity, type`,
      [dbId, quantityChange]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id} `);
    }
    return medicine;
  }

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    await this.waitForReady();
    const cached = this.cache.get<Treatment[]>("treatments");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbTreatmentRow>(
      "SELECT id, name, default_price, type, equipments FROM treatments ORDER BY name ASC"
    );
    const treatments = rows.map(mapTreatment);
    this.cache.set("treatments", treatments);
    return treatments;
  }

  async getTreatment(id: string): Promise<Treatment | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `treatment:${normalizedId} `;
    const cached = this.cache.get<Treatment>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("treatments", id);
    const { rows } = await pool.query<DbTreatmentRow>(
      "SELECT id, name, default_price, type, equipments FROM treatments WHERE id = $1",
      [dbId]
    );
    const treatment = rows[0] ? mapTreatment(rows[0]) : undefined;
    if (treatment) {
      this.cache.set(cacheKey, treatment);
    }
    return treatment;
  }

  async createTreatment(insertTreatment: InsertTreatment): Promise<Treatment> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("treatments");
    const query = useNumericId
      ? `INSERT INTO treatments(name, default_price, type, equipments)
          VALUES($1, $2, $3, $4)
         RETURNING id, name, default_price, type, equipments`
      : `INSERT INTO treatments(id, name, default_price, type, equipments)
          VALUES($1, $2, $3, $4, $5)
         RETURNING id, name, default_price, type, equipments`;
    const params = useNumericId
      ? [insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.type || 'General', JSON.stringify(insertTreatment.equipments || [])]
      : [randomUUID(), insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.type || 'General', JSON.stringify(insertTreatment.equipments || [])];
    const { rows } = await pool.query<DbTreatmentRow>(query, params);
    const treatment = mapTreatment(rows[0]);
    this.cache.invalidate("treatments");
    this.cache.invalidate("treatment:");
    return treatment;
  }

  async updateTreatment(id: string, insertTreatment: InsertTreatment): Promise<Treatment | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("treatments", id);
    const { rows } = await pool.query<DbTreatmentRow>(
      `UPDATE treatments
       SET name = $2,
            default_price = $3,
            type = $4,
            equipments = $5
       WHERE id = $1
       RETURNING id, name, default_price, type, equipments`,
      [dbId, insertTreatment.name, insertTreatment.defaultPrice, insertTreatment.type || 'General', JSON.stringify(insertTreatment.equipments || [])]
    );
    const treatment = rows[0] ? mapTreatment(rows[0]) : undefined;
    if (treatment) {
      this.cache.invalidate("treatments");
      this.cache.invalidate(`treatment:${treatment.id} `);
    }
    return treatment;
  }

  async deleteTreatment(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("treatments", id);
    const result = await pool.query("DELETE FROM treatments WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("treatments");
      this.cache.invalidate(`treatment:${normalizeId(id)} `);
    }
    return success;
  }

  // Departments
  async getDepartments(): Promise<Department[]> {
    await this.waitForReady();
    const cached = this.cache.get<Department[]>("departments");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<{ id: string; name: string }>(
      "SELECT id, name FROM departments ORDER BY name ASC"
    );
    const departments = rows.map(r => ({ id: normalizeId(r.id), name: r.name }));
    this.cache.set("departments", departments);
    return departments;
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("departments", id);
    const { rows } = await pool.query<{ id: string; name: string }>(
      "SELECT id, name FROM departments WHERE id = $1",
      [dbId]
    );
    return rows[0] ? { id: normalizeId(rows[0].id), name: rows[0].name } : undefined;
  }

  async createDepartment(insert: InsertDepartment): Promise<Department> {
    await this.waitForReady();
    const id = randomUUID();
    const { rows } = await pool.query<{ id: string; name: string }>(
      "INSERT INTO departments (id, name) VALUES ($1, $2) RETURNING id, name",
      [id, insert.name]
    );
    const dept = { id: normalizeId(rows[0].id), name: rows[0].name };
    this.cache.invalidate("departments");
    return dept;
  }

  async updateDepartment(id: string, insert: InsertDepartment): Promise<Department | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("departments", id);
    const { rows } = await pool.query<{ id: string; name: string }>(
      "UPDATE departments SET name = $1 WHERE id = $2 RETURNING id, name",
      [insert.name, dbId]
    );
    const dept = rows[0] ? { id: normalizeId(rows[0].id), name: rows[0].name } : undefined;
    if (dept) {
      this.cache.invalidate("departments");
    }
    return dept;
  }

  async deleteDepartment(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("departments", id);
    const result = await pool.query("DELETE FROM departments WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("departments");
    }
    return success;
  }

  // Bills
  async getBills(): Promise<Bill[]> {
    await this.waitForReady();
    const cached = this.cache.get<Bill[]>("bills");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount
       FROM bills
       ORDER BY date DESC`
    );
    const bills = rows.map(mapBill);
    this.cache.set("bills", bills);
    return bills;
  }

  async getBill(id: string): Promise<Bill | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `bill:${normalizedId}`;
    const cached = this.cache.get<Bill>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("bills", id);
    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount
       FROM bills
       WHERE id = $1`,
      [dbId]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      this.cache.set(cacheKey, bill);
    }
    return bill;
  }

  async createBill(insertBill: InsertBill, patientName: string): Promise<Bill> {
    await this.waitForReady();
    try {
      const patientIdValue = this.convertId("patients", insertBill.patientId);
      const pendingAmount = Math.max(0, insertBill.finalAmount - insertBill.amountPaid);
      const useNumericId = this.usesNumericId("bills");
      const query = useNumericId
        ? `INSERT INTO bills(
              patient_id,
              patient_name,
              date,
              treatments,
              medicines,
              treatment_total,
              medicine_total,
              grand_total,
              discount,
              discount_type,
              final_amount,
              amount_paid,
              pending_amount
            )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`
        : `INSERT INTO bills(
              id,
              patient_id,
              patient_name,
              date,
              treatments,
              medicines,
              treatment_total,
              medicine_total,
              grand_total,
              discount,
              discount_type,
              final_amount,
              amount_paid,
              pending_amount
            )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`;
      const params = useNumericId
        ? [
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(insertBill.treatments || []),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.discount,
          insertBill.discountType || "Percentage",
          insertBill.finalAmount,
          insertBill.amountPaid,
          pendingAmount,
        ]
        : [
          randomUUID(),
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(insertBill.treatments || []),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.discount,
          insertBill.discountType || "Percentage",
          insertBill.finalAmount,
          insertBill.amountPaid,
          pendingAmount,
        ];
      const { rows } = await pool.query<DbBillRow>(query, params);
      if (!rows[0]) {
        throw new Error("Failed to create bill - no rows returned");
      }
      const bill = mapBill(rows[0]);
      this.cache.invalidate("bills");
      this.cache.invalidate("bill:");
      return bill;
    } catch (error) {
      console.error("Error in createBill:", error);
      throw error;
    }
  }

  async createBillWithStockUpdate(insertBill: InsertBill, patientName: string): Promise<Bill> {
    await this.waitForReady();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Validate and Update Stock for regular medicines
      if (insertBill.medicines && insertBill.medicines.length > 0) {
        for (const med of insertBill.medicines) {
          if (med.medicineId) {
            const dbMedId = this.convertId("medicines", med.medicineId);

            // Check stock with lock
            const { rows } = await client.query<DbMedicineRow>(
              "SELECT * FROM medicines WHERE id = $1 FOR UPDATE",
              [dbMedId]
            );

            const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;

            if (!medicine) {
              throw new Error(`Medicine with ID ${med.medicineId} not found`);
            }

            if (medicine.quantity < med.quantity) {
              throw new Error(`Insufficient stock for ${medicine.name}. Available: ${medicine.quantity}, Required: ${med.quantity}`);
            }

            // Deduct stock
            await client.query(
              "UPDATE medicines SET quantity = quantity - $2 WHERE id = $1",
              [dbMedId, med.quantity]
            );
          }
        }
      }

      // 1.5 Validate and Update Equipment Stock for Surgery Treatments
      const processedTreatments = [];
      if (insertBill.treatments && insertBill.treatments.length > 0) {
        for (const t of insertBill.treatments) {
          const dbTreatmentId = this.convertId("treatments", t.treatmentId);
          const { rows: tRows } = await client.query<DbTreatmentRow>(
            "SELECT * FROM treatments WHERE id = $1",
            [dbTreatmentId]
          );
          const treatmentObj = tRows[0] ? mapTreatment(tRows[0]) : undefined;
          
          const tEquipments = (treatmentObj && treatmentObj.type === "Surgery" && treatmentObj.equipments)
            ? treatmentObj.equipments
            : [];
            
          processedTreatments.push({
            ...t,
            equipments: tEquipments
          });

          for (const eq of tEquipments) {
            if (eq.medicineId) {
              const dbEquipMedId = this.convertId("medicines", eq.medicineId);

              // Check stock with lock
              const { rows: eqMedRows } = await client.query<DbMedicineRow>(
                "SELECT * FROM medicines WHERE id = $1 FOR UPDATE",
                [dbEquipMedId]
              );

              const eqMedicine = eqMedRows[0] ? mapMedicine(eqMedRows[0]) : undefined;

              if (!eqMedicine) {
                // Equipment medicine was deleted – skip stock deduction silently
                console.warn(`Surgery equipment item with ID ${eq.medicineId} no longer exists in medicines table – skipping stock deduction`);
                continue;
              }

              if (eqMedicine.quantity < eq.quantity) {
                throw new Error(`Insufficient stock for surgery equipment "${eqMedicine.name}". Available: ${eqMedicine.quantity}, Required: ${eq.quantity}`);
              }

              // Deduct stock
              await client.query(
                "UPDATE medicines SET quantity = quantity - $2 WHERE id = $1",
                [dbEquipMedId, eq.quantity]
              );
            }
          }
        }
      }

      // 2. Create Bill
      const patientIdValue = this.convertId("patients", insertBill.patientId);
      const pendingAmount = Math.max(0, insertBill.finalAmount - insertBill.amountPaid);
      const useNumericId = this.usesNumericId("bills");

      const query = useNumericId
        ? `INSERT INTO bills(
              patient_id,
              patient_name,
              date,
              treatments,
              medicines,
              treatment_total,
              medicine_total,
              grand_total,
              discount,
              discount_type,
              final_amount,
              amount_paid,
              pending_amount
            )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`
        : `INSERT INTO bills(
              id,
              patient_id,
              patient_name,
              date,
              treatments,
              medicines,
              treatment_total,
              medicine_total,
              grand_total,
              discount,
              discount_type,
              final_amount,
              amount_paid,
              pending_amount
            )
          VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`;

      const params = useNumericId
        ? [
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(processedTreatments),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.discount,
          insertBill.discountType || "Percentage",
          insertBill.finalAmount,
          insertBill.amountPaid,
          pendingAmount,
        ]
        : [
          randomUUID(),
          patientIdValue,
          patientName,
          insertBill.date,
          JSON.stringify(processedTreatments),
          JSON.stringify(insertBill.medicines || []),
          insertBill.treatmentTotal,
          insertBill.medicineTotal,
          insertBill.grandTotal,
          insertBill.discount,
          insertBill.discountType || "Percentage",
          insertBill.finalAmount,
          insertBill.amountPaid,
          pendingAmount,
        ];

      const { rows } = await client.query<DbBillRow>(query, params);

      if (!rows[0]) {
        throw new Error("Failed to create bill - no rows returned");
      }

      await client.query('COMMIT');

      const bill = mapBill(rows[0]);

      // Invalidate caches
      this.cache.invalidate("bills");
      this.cache.invalidate("bill:");
      this.cache.invalidate("medicines"); // Stocks changed
      this.cache.invalidate("medicine:");

      return bill;

    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error in createBillWithStockUpdate:", error);
      throw error;
    } finally {
      client.release();
    }
  }
  async updateBill(id: string, insertBill: InsertBill, patientName: string): Promise<Bill | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const pendingAmount = Math.max(0, insertBill.finalAmount - insertBill.amountPaid);
    const { rows } = await pool.query<DbBillRow>(
      `UPDATE bills
       SET patient_id = $2,
            patient_name = $3,
            date = $4,
            treatments = $5,
            medicines = $6,
            treatment_total = $7,
            medicine_total = $8,
            grand_total = $9,
            discount = $10,
            discount_type = $14,
            final_amount = $11,
            amount_paid = $12,
            pending_amount = $13
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`,
      [
        dbId,
        this.convertId("patients", insertBill.patientId),
        patientName,
        insertBill.date,
        JSON.stringify(insertBill.treatments),
        JSON.stringify(insertBill.medicines),
        insertBill.treatmentTotal,
        insertBill.medicineTotal,
        insertBill.grandTotal,
        insertBill.discount,
        insertBill.finalAmount,
        insertBill.amountPaid,
        pendingAmount,
        insertBill.discountType || "Percentage",
      ]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      if (insertBill.paymentMode) {
        await pool.query(
          `UPDATE payment_ledger 
           SET payment_mode = $1 
           WHERE bill_id = $2 
           AND id = (
             SELECT id FROM payment_ledger 
             WHERE bill_id = $2 
             ORDER BY date ASC, id ASC 
             LIMIT 1
           )`,
          [insertBill.paymentMode, dbId]
        );
      }
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${bill.id}`);
      this.cache.invalidate("payment_ledgers");
    }
    return bill;
  }

  async updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const { rows } = await pool.query<DbBillRow>(
      `UPDATE bills
       SET amount_paid = $2,
            pending_amount = GREATEST(0, final_amount - $2)
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount`,
      [dbId, amountPaid]
    );
    const bill = rows[0] ? mapBill(rows[0]) : undefined;
    if (bill) {
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${bill.id}`);
    }
    return bill;
  }

  async deleteBill(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const result = await pool.query("DELETE FROM bills WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${normalizeId(id)}`);
    }
    return success;
  }

  async updatePatientBillsName(patientId: string, patientName: string): Promise<void> {
    await this.waitForReady();
    const dbPatientId = this.convertId("patients", patientId);
    await pool.query(
      "UPDATE bills SET patient_name = $1 WHERE patient_id = $2",
      [patientName, dbPatientId]
    );
    this.cache.invalidate("bills");
    this.cache.invalidate("bill:");
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    await this.waitForReady();
    const cached = this.cache.get<Expense[]>("expenses");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbExpenseRow>(
      "SELECT id, description, amount, date, category FROM expenses ORDER BY date DESC"
    );
    const expenses = rows.map(mapExpense);
    this.cache.set("expenses", expenses);
    return expenses;
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `expense: ${ normalizedId } `;
    const cached = this.cache.get<Expense>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("expenses", id);
    const { rows } = await pool.query<DbExpenseRow>(
      "SELECT id, description, amount, date, category FROM expenses WHERE id = $1",
      [dbId]
    );
    const expense = rows[0] ? mapExpense(rows[0]) : undefined;
    if (expense) {
      this.cache.set(cacheKey, expense);
    }
    return expense;
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("expenses");
    const query = useNumericId
      ? `INSERT INTO expenses(description, amount, date, category)
          VALUES($1, $2, $3, $4)
         RETURNING id, description, amount, date, category`
      : `INSERT INTO expenses(id, description, amount, date, category)
          VALUES($1, $2, $3, $4, $5)
         RETURNING id, description, amount, date, category`;
    const params = useNumericId
      ? [insertExpense.description, insertExpense.amount, insertExpense.date, insertExpense.category]
      : [
        randomUUID(),
        insertExpense.description,
        insertExpense.amount,
        insertExpense.date,
        insertExpense.category,
      ];
    const { rows } = await pool.query<DbExpenseRow>(query, params);
    const expense = mapExpense(rows[0]);
    this.cache.invalidate("expenses");
    this.cache.invalidate("expense:");
    return expense;
  }

  async updateExpense(id: string, insertExpense: InsertExpense): Promise<Expense | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("expenses", id);
    const { rows } = await pool.query<DbExpenseRow>(
      `UPDATE expenses
       SET description = $2,
            amount = $3,
            date = $4,
            category = $5
       WHERE id = $1
       RETURNING id, description, amount, date, category`,
      [dbId, insertExpense.description, insertExpense.amount, insertExpense.date, insertExpense.category]
    );
    const expense = rows[0] ? mapExpense(rows[0]) : undefined;
    if (expense) {
      this.cache.invalidate("expenses");
      this.cache.invalidate(`expense: ${ expense.id } `);
    }
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("expenses", id);
    const result = await pool.query("DELETE FROM expenses WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("expenses");
      this.cache.invalidate(`expense: ${ normalizeId(id) } `);
    }
    return success;
  }

  // ==================== PAGINATION METHODS ====================

  async getPatientsPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Patient[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM patients"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbPatientRow>(
      `SELECT id, name, phone, registration_date, dob, status, source, department FROM patients 
       ORDER BY registration_date DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapPatient);
    return { data, total };
  }

  async getMedicinesPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Medicine[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM medicines"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbMedicineRow>(
      `SELECT id, name, purchase_cost, selling_price, quantity, type, vendor_name FROM medicines 
       ORDER BY name ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapMedicine);
    return { data, total };
  }

  async getTreatmentsPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Treatment[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM treatments"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbTreatmentRow>(
      `SELECT id, name, default_price, type, equipments FROM treatments 
       ORDER BY name ASC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapTreatment);
    return { data, total };
  }

  async getBillsPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Bill[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM bills"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbBillRow>(
      `SELECT id, patient_id, patient_name, date, treatments, medicines,
            treatment_total, medicine_total, grand_total, discount, discount_type, final_amount, amount_paid, pending_amount
       FROM bills
       ORDER BY date DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapBill);
    return { data, total };
  }

  async getExpensesPaginated(
    limit: number = 50,
    offset: number = 0
  ): Promise<{ data: Expense[]; total: number }> {
    await this.waitForReady();
    const { rows: countResult } = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM expenses"
    );
    const total = parseInt(countResult[0]?.count || "0", 10);

    const { rows } = await pool.query<DbExpenseRow>(
      `SELECT id, description, amount, date, category FROM expenses 
       ORDER BY date DESC 
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    const data = rows.map(mapExpense);
    return { data, total };
  }

  // Appointments
  async getAppointments(): Promise<Appointment[]> {
    await this.waitForReady();
    const cached = this.cache.get<Appointment[]>("appointments");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status, a.type 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       ORDER BY a.date ASC, a.time ASC`
    );
    const appointments = rows.map(mapAppointment);
    this.cache.set("appointments", appointments);
    return appointments;
  }

  async getAppointment(id: string): Promise<Appointment | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `appointment: ${ normalizedId }`;
    const cached = this.cache.get<Appointment>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("appointments", id);
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status, a.type 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
       [dbId]
    );
    const appointment = rows[0] ? mapAppointment(rows[0]) : undefined;
    if (appointment) {
      this.cache.set(cacheKey, appointment);
    }
    return appointment;
  }

  async getAppointmentsByPatient(patientId: string): Promise<Appointment[]> {
    await this.waitForReady();
    const normalizedPatientId = normalizeId(patientId);
    const cacheKey = `appointments: patient: ${ normalizedPatientId }`;
    const cached = this.cache.get<Appointment[]>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbPatientId = this.convertId("patients", patientId);
    const { rows } = await pool.query<DbAppointmentRow>(
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status, a.type 
       FROM appointments a
       LEFT JOIN patients p ON a.patient_id = p.id
       WHERE a.patient_id = $1
       ORDER BY a.date ASC, a.time ASC`,
       [dbPatientId]
    );
    const appointments = rows.map(mapAppointment);
    this.cache.set(cacheKey, appointments);
    return appointments;
  }

  async createAppointment(insert: InsertAppointment): Promise<Appointment> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("appointments");
    const query = useNumericId
      ? `INSERT INTO appointments(patient_id, date, time, reason, status, type)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, patient_id, date, time, reason, status, type`
      : `INSERT INTO appointments(id, patient_id, date, time, reason, status, type)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, patient_id, date, time, reason, status, type`;

    const dbPatientId = this.convertId("patients", insert.patientId);

    const params = useNumericId
      ? [dbPatientId, insert.date, insert.time, insert.reason, insert.status, insert.type || "New"]
      : [randomUUID(), dbPatientId, insert.date, insert.time, insert.reason, insert.status, insert.type || "New"];

    const { rows } = await pool.query<DbAppointmentRow>(query, params);

    // Fetch patient name for the return object
    const patientNameQuery = await pool.query<{ name: string }>("SELECT name FROM patients WHERE id = $1", [dbPatientId]);
    const patientName = patientNameQuery.rows[0]?.name;

    const appointment = mapAppointment({
      ...rows[0],
      patient_name: patientName
    });

    this.cache.invalidate("appointments");
    this.cache.invalidate(`appointments: patient: ${ normalizeId(insert.patientId)
        } `);
    return appointment;
  }

  async updateAppointment(id: string, insert: InsertAppointment): Promise<Appointment | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("appointments", id);
    const dbPatientId = this.convertId("patients", insert.patientId);

    const { rows } = await pool.query<DbAppointmentRow>(
      `UPDATE appointments
       SET patient_id = $2, date = $3, time = $4, reason = $5, status = $6, type = $7
       WHERE id = $1
       RETURNING id, patient_id, date, time, reason, status, type`,
      [dbId, dbPatientId, insert.date, insert.time, insert.reason, insert.status, insert.type || "New"]
    );

    if (!rows[0]) return undefined;

    // Fetch patient name
    const patientNameQuery = await pool.query<{ name: string }>("SELECT name FROM patients WHERE id = $1", [dbPatientId]);
    const patientName = patientNameQuery.rows[0]?.name;

    const appointment = mapAppointment({
      ...rows[0],
      patient_name: patientName
    });

    this.cache.invalidate("appointments");
    this.cache.invalidate(`appointment:${ appointment.id } `);
    this.cache.invalidate(`appointments: patient:${ normalizeId(insert.patientId) } `);
    return appointment;
  }

  async deleteAppointment(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("appointments", id);

    // Get appointment to invalidate cache
    const appt = await this.getAppointment(id);

    const result = await pool.query("DELETE FROM appointments WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;

    if (success) {
      this.cache.invalidate("appointments");
      this.cache.invalidate(`appointment:${ normalizeId(id) } `);
      if (appt) {
        this.cache.invalidate(`appointments: patient:${ appt.patientId } `);
      }
    }
    return success;
  }

  // Payment Ledger
  async getPaymentLedgers(): Promise<PaymentLedger[]> {
    await this.waitForReady();
    const cached = this.cache.get<PaymentLedger[]>("payment_ledgers");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbPaymentLedgerRow>(
      `SELECT id, bill_id, patient_id, amount, date, payment_mode FROM payment_ledger ORDER BY date DESC`
    );
    const ledgers = rows.map(mapPaymentLedger);
    this.cache.set("payment_ledgers", ledgers);
    return ledgers;
  }

  async createPaymentLedgerEntry(insert: InsertPaymentLedger): Promise<PaymentLedger> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("payment_ledger");
    const query = useNumericId
      ? `INSERT INTO payment_ledger(bill_id, patient_id, amount, date, payment_mode)
         VALUES($1, $2, $3, $4, $5)
         RETURNING id, bill_id, patient_id, amount, date, payment_mode`
      : `INSERT INTO payment_ledger(id, bill_id, patient_id, amount, date, payment_mode)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, bill_id, patient_id, amount, date, payment_mode`;

    const dbBillId = this.convertId("bills", insert.billId);
    const dbPatientId = this.convertId("patients", insert.patientId);

    const params = useNumericId
      ? [dbBillId, dbPatientId, insert.amount, insert.date, insert.paymentMode]
      : [randomUUID(), dbBillId, dbPatientId, insert.amount, insert.date, insert.paymentMode];

    const { rows } = await pool.query<DbPaymentLedgerRow>(query, params);
    const ledger = mapPaymentLedger(rows[0]);

    this.cache.invalidate("payment_ledgers");
    return ledger;
  }

  // CRM - Leads
  async getLeads(): Promise<Lead[]> {
    await this.waitForReady();
    const cached = this.cache.get<Lead[]>("crm:leads");
    if (cached) return cached;
    const { rows } = await pool.query<DbLeadRow>(
      "SELECT id, name, phone, status, source, notes, created_at, converted_patient_id FROM leads ORDER BY created_at DESC"
    );
    const leads = rows.map(mapLead);
    this.cache.set("crm:leads", leads);
    return leads;
  }

  async getLead(id: string): Promise<Lead | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("leads", id);
    const { rows } = await pool.query<DbLeadRow>(
      "SELECT id, name, phone, status, source, notes, created_at, converted_patient_id FROM leads WHERE id = $1",
      [dbId]
    );
    return rows[0] ? mapLead(rows[0]) : undefined;
  }

  async createLead(insert: InsertLead): Promise<Lead> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("leads");
    const query = useNumericId
      ? `INSERT INTO leads(name, phone, status, source, notes, created_at, converted_patient_id)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, phone, status, source, notes, created_at, converted_patient_id`
      : `INSERT INTO leads(id, name, phone, status, source, notes, created_at, converted_patient_id)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, name, phone, status, source, notes, created_at, converted_patient_id`;

    const dbPatientId = insert.convertedPatientId ? this.convertId("patients", insert.convertedPatientId) : null;
    const params = useNumericId
      ? [insert.name, insert.phone, insert.status, insert.source, insert.notes, insert.createdAt, dbPatientId]
      : [randomUUID(), insert.name, insert.phone, insert.status, insert.source, insert.notes, insert.createdAt, dbPatientId];

    const { rows } = await pool.query<DbLeadRow>(query, params);
    const lead = mapLead(rows[0]);
    this.cache.invalidate("crm:leads");
    return lead;
  }

  async updateLead(id: string, insert: InsertLead): Promise<Lead | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("leads", id);
    const dbPatientId = insert.convertedPatientId ? this.convertId("patients", insert.convertedPatientId) : null;
    const { rows } = await pool.query<DbLeadRow>(
      `UPDATE leads
       SET name = $2, phone = $3, status = $4, source = $5, notes = $6, converted_patient_id = $7
       WHERE id = $1
       RETURNING id, name, phone, status, source, notes, created_at, converted_patient_id`,
      [dbId, insert.name, insert.phone, insert.status, insert.source, insert.notes, dbPatientId]
    );
    const lead = rows[0] ? mapLead(rows[0]) : undefined;
    if (lead) {
      this.cache.invalidate("crm:leads");
    }
    return lead;
  }

  async deleteLead(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("leads", id);
    const result = await pool.query("DELETE FROM leads WHERE id = $1", [dbId]);
    const success = (result.rowCount ?? 0) > 0;
    if (success) {
      this.cache.invalidate("crm:leads");
    }
    return success;
  }

  // CRM - Interactions
  async getInteractions(patientId?: string, leadId?: string): Promise<CRMInteraction[]> {
    await this.waitForReady();
    let queryStr = "SELECT id, patient_id, lead_id, date, type, channel, notes, outcome FROM crm_interactions";
    const params: any[] = [];

    if (patientId) {
      queryStr += " WHERE patient_id = $1";
      params.push(this.convertId("patients", patientId));
    } else if (leadId) {
      queryStr += " WHERE lead_id = $1";
      params.push(this.convertId("leads", leadId));
    }
    queryStr += " ORDER BY date DESC";

    const { rows } = await pool.query<DbCRMInteractionRow>(queryStr, params);
    return rows.map(mapCRMInteraction);
  }

  async createInteraction(insert: InsertCRMInteraction): Promise<CRMInteraction> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("crm_interactions");
    const query = useNumericId
      ? `INSERT INTO crm_interactions(patient_id, lead_id, date, type, channel, notes, outcome)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, patient_id, lead_id, date, type, channel, notes, outcome`
      : `INSERT INTO crm_interactions(id, patient_id, lead_id, date, type, channel, notes, outcome)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id, patient_id, lead_id, date, type, channel, notes, outcome`;

    const dbPatientId = insert.patientId ? this.convertId("patients", insert.patientId) : null;
    const dbLeadId = insert.leadId ? this.convertId("leads", insert.leadId) : null;

    const params = useNumericId
      ? [dbPatientId, dbLeadId, insert.date, insert.type, insert.channel, insert.notes, insert.outcome]
      : [randomUUID(), dbPatientId, dbLeadId, insert.date, insert.type, insert.channel, insert.notes, insert.outcome];

    const { rows } = await pool.query<DbCRMInteractionRow>(query, params);
    return mapCRMInteraction(rows[0]);
  }

  async updateInteraction(id: string, update: Partial<InsertCRMInteraction>): Promise<CRMInteraction | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("crm_interactions", id);

    // 1. Fetch current interaction to merge fields safely
    const { rows: currentRows } = await pool.query<DbCRMInteractionRow>(
      "SELECT id, patient_id, lead_id, date, type, channel, notes, outcome FROM crm_interactions WHERE id = $1",
      [dbId]
    );
    const current = currentRows[0];
    if (!current) return undefined;

    // 2. Resolve field values (retain existing if undefined in update payload)
    const dbPatientId = update.patientId !== undefined
      ? (update.patientId ? this.convertId("patients", update.patientId) : null)
      : current.patient_id;

    const dbLeadId = update.leadId !== undefined
      ? (update.leadId ? this.convertId("leads", update.leadId) : null)
      : current.lead_id;

    const date = update.date !== undefined ? update.date : current.date;
    const type = update.type !== undefined ? update.type : current.type;
    const channel = update.channel !== undefined ? update.channel : current.channel;
    const notes = update.notes !== undefined ? update.notes : current.notes;
    const outcome = update.outcome !== undefined ? update.outcome : current.outcome;

    // 3. Update with resolved values
    const { rows } = await pool.query<DbCRMInteractionRow>(
      `UPDATE crm_interactions
       SET patient_id = $1,
           lead_id = $2,
           date = $3,
           type = $4,
           channel = $5,
           notes = $6,
           outcome = $7
       WHERE id = $8
       RETURNING id, patient_id, lead_id, date, type, channel, notes, outcome`,
      [
        dbPatientId,
        dbLeadId,
        date,
        type,
        channel,
        notes,
        outcome,
        dbId,
      ]
    );
    return rows[0] ? mapCRMInteraction(rows[0]) : undefined;
  }

  // CRM - Tasks
  async getCRMTasks(): Promise<CRMTask[]> {
    await this.waitForReady();
    const { rows } = await pool.query<DbCRMTaskRow>(
      `SELECT t.id, t.description, t.patient_id, p.name as patient_name, t.lead_id, l.name as lead_name, t.due_date, t.status, t.priority
       FROM crm_tasks t
       LEFT JOIN patients p ON t.patient_id = p.id
       LEFT JOIN leads l ON t.lead_id = l.id
       ORDER BY t.due_date ASC`
    );
    return rows.map(mapCRMTask);
  }

  async createCRMTask(insert: InsertCRMTask): Promise<CRMTask> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("crm_tasks");
    const query = useNumericId
      ? `INSERT INTO crm_tasks(description, patient_id, lead_id, due_date, status, priority)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, description, patient_id, lead_id, due_date, status, priority`
      : `INSERT INTO crm_tasks(id, description, patient_id, lead_id, due_date, status, priority)
         VALUES($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, description, patient_id, lead_id, due_date, status, priority`;

    const dbPatientId = insert.patientId ? this.convertId("patients", insert.patientId) : null;
    const dbLeadId = insert.leadId ? this.convertId("leads", insert.leadId) : null;

    const params = useNumericId
      ? [insert.description, dbPatientId, dbLeadId, insert.dueDate, insert.status, insert.priority]
      : [randomUUID(), insert.description, dbPatientId, dbLeadId, insert.dueDate, insert.status, insert.priority];

    const { rows } = await pool.query<DbCRMTaskRow>(query, params);
    return mapCRMTask(rows[0]);
  }

  async updateCRMTaskStatus(id: string, status: "Pending" | "Completed"): Promise<CRMTask | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("crm_tasks", id);
    const { rows } = await pool.query<DbCRMTaskRow>(
      `UPDATE crm_tasks
       SET status = $2
       WHERE id = $1
       RETURNING id, description, patient_id, lead_id, due_date, status, priority`,
      [dbId, status]
    );
    return rows[0] ? mapCRMTask(rows[0]) : undefined;
  }

  async deleteCRMTask(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("crm_tasks", id);
    const result = await pool.query("DELETE FROM crm_tasks WHERE id = $1", [dbId]);
    return (result.rowCount ?? 0) > 0;
  }

  async ping(): Promise<boolean> {
    await this.waitForReady();
    await pool.query("SELECT 1");
    return true;
  }

  async getUsers(): Promise<User[]> {
    await this.waitForReady();
    const { rows } = await pool.query<DbUserRow>(
      "SELECT id, username, password, role, permissions, created_at FROM users ORDER BY username ASC"
    );
    return rows.map(mapUser);
  }

  async getUser(id: string): Promise<User | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("users", id);
    const { rows } = await pool.query<DbUserRow>(
      "SELECT id, username, password, role, permissions, created_at FROM users WHERE id = $1",
      [dbId]
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query<DbUserRow>(
      "SELECT id, username, password, role, permissions, created_at FROM users WHERE username = $1",
      [username]
    );
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async getUserByUsernameRow(username: string): Promise<any | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query<DbUserRow>(
      "SELECT id, username, password, role, permissions, created_at FROM users WHERE username = $1",
      [username]
    );
    return rows[0] ? {
      id: normalizeId(rows[0].id),
      username: rows[0].username,
      password_hash: rows[0].password, // plain text password mapped to password_hash field
      role: rows[0].role,
      permissions: rows[0].permissions || {},
      createdAt: rows[0].created_at,
    } : undefined;
  }

  async createUser(insert: RegisterInput): Promise<User> {
    await this.waitForReady();
    const useNumericId = this.usesNumericId("users");
    const query = useNumericId
      ? `INSERT INTO users(username, password, role, permissions)
         VALUES($1, $2, $3, $4)
         RETURNING id, username, password, role, permissions, created_at`
      : `INSERT INTO users(id, username, password, role, permissions)
         VALUES($1, $2, $3, $4, $5)
         RETURNING id, username, password, role, permissions, created_at`;

    const params = useNumericId
      ? [insert.username, insert.password, insert.role || "Staff", JSON.stringify(insert.permissions || {})]
      : [randomUUID(), insert.username, insert.password, insert.role || "Staff", JSON.stringify(insert.permissions || {})];

    const { rows } = await pool.query<DbUserRow>(query, params);
    return mapUser(rows[0]);
  }

  async updateUser(id: string, update: Partial<RegisterInput>): Promise<User | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("users", id);
    
    // Dynamically build update query
    const fields: string[] = [];
    const values: any[] = [dbId];
    let placeholderIndex = 2;

    if (update.username !== undefined) {
      fields.push(`username = $${placeholderIndex++}`);
      values.push(update.username);
    }
    if (update.password !== undefined) {
      fields.push(`password = $${placeholderIndex++}`);
      values.push(update.password);
    }
    if (update.role !== undefined) {
      fields.push(`role = $${placeholderIndex++}`);
      values.push(update.role);
    }
    if (update.permissions !== undefined) {
      fields.push(`permissions = $${placeholderIndex++}`);
      values.push(JSON.stringify(update.permissions));
    }

    if (fields.length === 0) {
      return this.getUser(id);
    }

    const query = `UPDATE users SET ${fields.join(", ")} WHERE id = $1 RETURNING id, username, password, role, permissions, created_at`;
    const { rows } = await pool.query<DbUserRow>(query, values);
    return rows[0] ? mapUser(rows[0]) : undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.waitForReady();
    const dbId = this.convertId("users", id);
    const result = await pool.query("DELETE FROM users WHERE id = $1", [dbId]);
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== WHATSAPP AUTOMATION ====================

  // ---- Settings ----
  async getWhatsappSettings(): Promise<WhatsappSettings> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_settings WHERE id = 1`);
    if (!rows[0]) {
      await pool.query(`INSERT INTO whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING`);
      const { rows: retry } = await pool.query(`SELECT * FROM whatsapp_settings WHERE id = 1`);
      return mapSettings(retry[0]);
    }
    return mapSettings(rows[0]);
  }

  async updateWhatsappSettings(update: UpdateSettings): Promise<WhatsappSettings> {
    await this.waitForReady();
    await this.getWhatsappSettings();
    const columnMap: Record<string, string> = {
      enabled: "enabled",
      businessHoursEnabled: "business_hours_enabled",
      businessHoursStart: "business_hours_start",
      businessHoursEnd: "business_hours_end",
      timezone: "timezone",
      maxPerContactPerDay: "max_per_contact_per_day",
      minGapMinutes: "min_gap_minutes",
    };
    const fields: string[] = [];
    const values: any[] = [];
    let idx = 1;
    for (const [key, column] of Object.entries(columnMap)) {
      const value = (update as any)[key];
      if (value !== undefined) {
        fields.push(`${column} = $${idx++}`);
        values.push(value);
      }
    }
    if (fields.length > 0) {
      values.push(1);
      await pool.query(`UPDATE whatsapp_settings SET ${fields.join(", ")} WHERE id = $${idx}`, values);
    }
    return this.getWhatsappSettings();
  }

  // ---- Templates (synced cache from QuickAuth) ----
  async getWhatsappTemplates(): Promise<WhatsappTemplate[]> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_templates ORDER BY name ASC`);
    return rows.map(mapWhatsappTemplate);
  }

  async getWhatsappTemplate(templateId: string): Promise<WhatsappTemplate | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_templates WHERE template_id = $1`, [templateId]);
    return rows[0] ? mapWhatsappTemplate(rows[0]) : undefined;
  }

  async upsertWhatsappTemplate(t: WhatsappTemplate): Promise<WhatsappTemplate> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `INSERT INTO whatsapp_templates (template_id, name, language, category, status, header_type, header_text, body, footer, variables, buttons, last_synced_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())
       ON CONFLICT (template_id) DO UPDATE SET
         name=$2, language=$3, category=$4, status=$5, header_type=$6, header_text=$7, body=$8, footer=$9, variables=$10, buttons=$11, last_synced_at=NOW()
       RETURNING *`,
      [t.templateId, t.name, t.language, t.category, t.status, t.headerType || "", t.headerText || "", t.body || "", t.footer || "", JSON.stringify(t.variables || []), JSON.stringify(t.buttons || [])]
    );
    return mapWhatsappTemplate(rows[0]);
  }

  // ---- Rules ----
  private async insertRuleChildrenTx(client: PoolClient, ruleId: string, input: InsertRule): Promise<void> {
    for (const c of input.conditions) {
      await client.query(
        `INSERT INTO whatsapp_automation_conditions (id, rule_id, field, operator, value, group_no) VALUES ($1,$2,$3,$4,$5,$6)`,
        [randomUUID(), ruleId, c.field, c.operator, c.value, c.groupNo]
      );
    }
    for (let i = 0; i < input.steps.length; i++) {
      const s = input.steps[i];
      await client.query(
        `INSERT INTO whatsapp_automation_steps (id, rule_id, step_order, delay_type, delay_unit, delay_value, specific_time, template_id, message_type, variable_mapping)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [randomUUID(), ruleId, i, s.delayType, s.delayUnit, s.delayValue, s.specificTime, s.templateId, s.messageType, JSON.stringify(s.variableMapping || {})]
      );
    }
    for (const stopType of input.stopConditions) {
      await client.query(
        `INSERT INTO whatsapp_automation_stop_conditions (id, rule_id, type) VALUES ($1,$2,$3)`,
        [randomUUID(), ruleId, stopType]
      );
    }
  }

  async getWhatsappRules(): Promise<WhatsappAutomationRule[]> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_automation_rules ORDER BY created_at DESC`);
    return rows.map(mapRule);
  }

  async getWhatsappRuleDetail(id: string): Promise<WhatsappAutomationRuleDetail | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_automation_rules WHERE id = $1`, [id]);
    if (!rows[0]) return undefined;
    const rule = mapRule(rows[0]);
    const [condRes, stepRes, stopRes] = await Promise.all([
      pool.query(`SELECT * FROM whatsapp_automation_conditions WHERE rule_id = $1 ORDER BY group_no ASC`, [id]),
      pool.query(`SELECT * FROM whatsapp_automation_steps WHERE rule_id = $1 ORDER BY step_order ASC`, [id]),
      pool.query(`SELECT type FROM whatsapp_automation_stop_conditions WHERE rule_id = $1`, [id]),
    ]);
    return {
      ...rule,
      conditions: condRes.rows.map(mapCondition),
      steps: stepRes.rows.map(mapStep),
      stopConditions: stopRes.rows.map((r) => r.type as StopConditionType),
    };
  }

  async getActiveWhatsappRulesByTrigger(triggerType: string): Promise<WhatsappAutomationRuleDetail[]> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT id FROM whatsapp_automation_rules WHERE trigger_type = $1 AND status = 'Active'
       ORDER BY CASE priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END ASC, created_at ASC`,
      [triggerType]
    );
    const details = await Promise.all(rows.map((r) => this.getWhatsappRuleDetail(normalizeId(r.id))));
    return details.filter((d): d is WhatsappAutomationRuleDetail => !!d);
  }

  async createWhatsappRule(input: InsertRule, createdBy: string): Promise<WhatsappAutomationRuleDetail> {
    await this.waitForReady();
    const ruleId = randomUUID();
    await withTransaction(async (client) => {
      await client.query(
        `INSERT INTO whatsapp_automation_rules
          (id, name, description, status, priority, trigger_type, trigger_config, target_audience, custom_phone, business_hours_only, max_per_contact_per_day, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [ruleId, input.name, input.description, input.status, input.priority, input.triggerType, JSON.stringify(input.triggerConfig || {}), input.targetAudience, input.customPhone, input.businessHoursOnly, input.maxPerContactPerDay, createdBy]
      );
      await this.insertRuleChildrenTx(client, ruleId, input);
    });
    return (await this.getWhatsappRuleDetail(ruleId)) as WhatsappAutomationRuleDetail;
  }

  async updateWhatsappRule(id: string, input: InsertRule): Promise<WhatsappAutomationRuleDetail | undefined> {
    await this.waitForReady();
    const exists = await pool.query(`SELECT 1 FROM whatsapp_automation_rules WHERE id = $1`, [id]);
    if (!exists.rows[0]) return undefined;
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE whatsapp_automation_rules SET
          name=$2, description=$3, status=$4, priority=$5, trigger_type=$6, trigger_config=$7,
          target_audience=$8, custom_phone=$9, business_hours_only=$10, max_per_contact_per_day=$11, updated_at=NOW()
         WHERE id = $1`,
        [id, input.name, input.description, input.status, input.priority, input.triggerType, JSON.stringify(input.triggerConfig || {}), input.targetAudience, input.customPhone, input.businessHoursOnly, input.maxPerContactPerDay]
      );
      await client.query(`DELETE FROM whatsapp_automation_conditions WHERE rule_id = $1`, [id]);
      await client.query(`DELETE FROM whatsapp_automation_steps WHERE rule_id = $1`, [id]);
      await client.query(`DELETE FROM whatsapp_automation_stop_conditions WHERE rule_id = $1`, [id]);
      await this.insertRuleChildrenTx(client, id, input);
    });
    return this.getWhatsappRuleDetail(id);
  }

  async updateWhatsappRuleStatus(id: string, status: "Active" | "Inactive"): Promise<WhatsappAutomationRule | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`UPDATE whatsapp_automation_rules SET status=$2, updated_at=NOW() WHERE id=$1 RETURNING *`, [id, status]);
    return rows[0] ? mapRule(rows[0]) : undefined;
  }

  async deleteWhatsappRule(id: string): Promise<boolean> {
    await this.waitForReady();
    const result = await pool.query(`DELETE FROM whatsapp_automation_rules WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  // ---- Automation runs ----
  async getActiveWhatsappRun(ruleId: string, entityType: string, entityId: string, triggerEvent: string): Promise<WhatsappAutomationRun | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT * FROM whatsapp_automation_runs WHERE rule_id=$1 AND entity_type=$2 AND entity_id=$3 AND trigger_event=$4`,
      [ruleId, entityType, entityId, triggerEvent]
    );
    return rows[0] ? mapRun(rows[0]) : undefined;
  }

  /** Idempotent: returns undefined (no-op) if a run for this rule+entity+trigger already exists. */
  async createWhatsappRun(ruleId: string, entityType: string, entityId: string, triggerEvent: string): Promise<WhatsappAutomationRun | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `INSERT INTO whatsapp_automation_runs (id, rule_id, entity_type, entity_id, trigger_event)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (rule_id, entity_type, entity_id, trigger_event) DO NOTHING
       RETURNING *`,
      [randomUUID(), ruleId, entityType, entityId, triggerEvent]
    );
    return rows[0] ? mapRun(rows[0]) : undefined;
  }

  async getWhatsappRun(id: string): Promise<WhatsappAutomationRun | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_automation_runs WHERE id = $1`, [id]);
    return rows[0] ? mapRun(rows[0]) : undefined;
  }

  async updateWhatsappRunProgress(id: string, currentStep: number): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_automation_runs SET current_step=$2, updated_at=NOW() WHERE id=$1`, [id, currentStep]);
  }

  async completeWhatsappRun(id: string): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_automation_runs SET status='completed', updated_at=NOW() WHERE id=$1 AND status='active'`, [id]);
  }

  async stopWhatsappRun(id: string, reason: string): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_automation_runs SET status='stopped', stop_reason=$2, updated_at=NOW() WHERE id=$1 AND status='active'`, [id, reason]);
  }

  async getActiveWhatsappRunsForEntity(entityType: string, entityId: string): Promise<WhatsappAutomationRun[]> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT * FROM whatsapp_automation_runs WHERE entity_type=$1 AND entity_id=$2 AND status='active'`,
      [entityType, entityId]
    );
    return rows.map(mapRun);
  }

  async getWhatsappRuns(filters: { status?: string; ruleId?: string; limit?: number; offset?: number }): Promise<{ data: WhatsappAutomationRun[]; total: number }> {
    await this.waitForReady();
    const clauses: string[] = [];
    const params: any[] = [];
    if (filters.status) { params.push(filters.status); clauses.push(`r.status = $${params.length}`); }
    if (filters.ruleId) { params.push(filters.ruleId); clauses.push(`r.rule_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const { rows } = await pool.query(
      `SELECT r.*, ru.name as rule_name, COALESCE(l.name, p.name, ap_p.name) as entity_name
       FROM whatsapp_automation_runs r
       LEFT JOIN whatsapp_automation_rules ru ON ru.id = r.rule_id
       LEFT JOIN leads l ON r.entity_type = 'lead' AND l.id::text = r.entity_id
       LEFT JOIN patients p ON r.entity_type = 'patient' AND p.id::text = r.entity_id
       LEFT JOIN appointments ap ON r.entity_type = 'appointment' AND ap.id::text = r.entity_id
       LEFT JOIN patients ap_p ON ap.patient_id = ap_p.id
       ${where}
       ORDER BY r.started_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const { rows: countRows } = await pool.query(`SELECT COUNT(*) as count FROM whatsapp_automation_runs r ${where}`, params);
    return { data: rows.map(mapRun), total: Number(countRows[0]?.count || 0) };
  }

  // ---- Message jobs (queue + history combined) ----
  async createWhatsappJob(input: {
    runId: string; stepId: string; ruleId: string; entityType: string; entityId: string;
    phone: string; templateId: string; messageType: string; variables: Record<string, string>;
    renderedPreview: string; scheduledAt: Date; idempotencyKey: string; maxAttempts?: number;
  }): Promise<WhatsappMessageJob | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `INSERT INTO whatsapp_message_jobs
        (id, run_id, step_id, rule_id, entity_type, entity_id, phone, template_id, message_type, variables, rendered_preview, status, scheduled_at, max_attempts, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'queued',$12,$13,$14)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [randomUUID(), input.runId, input.stepId, input.ruleId, input.entityType, input.entityId, input.phone, input.templateId, input.messageType, JSON.stringify(input.variables), input.renderedPreview, input.scheduledAt.toISOString(), input.maxAttempts ?? 5, input.idempotencyKey]
    );
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async getDueWhatsappJobs(limit = 25): Promise<WhatsappMessageJob[]> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT j.* FROM whatsapp_message_jobs j
       LEFT JOIN whatsapp_automation_rules r ON r.id = j.rule_id
       WHERE j.status = 'queued' AND j.scheduled_at <= NOW()
       ORDER BY CASE r.priority WHEN 'High' THEN 0 WHEN 'Normal' THEN 1 ELSE 2 END ASC, j.scheduled_at ASC
       LIMIT $1`,
      [limit]
    );
    return rows.map(mapJob);
  }

  async getWhatsappJob(id: string): Promise<WhatsappMessageJob | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_message_jobs WHERE id = $1`, [id]);
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async markWhatsappJobSending(id: string): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_message_jobs SET status='sending', attempts = attempts + 1 WHERE id=$1`, [id]);
  }

  async rescheduleWhatsappJob(id: string, scheduledAt: Date, status: "queued" | "pending" = "queued"): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_message_jobs SET scheduled_at=$2, status=$3 WHERE id=$1`, [id, scheduledAt.toISOString(), status]);
  }

  async markWhatsappJobResult(id: string, fields: {
    status: MessageJobStatus; providerMessageId?: string; campaignId?: string; lastError?: string; sentAt?: Date;
  }): Promise<void> {
    await this.waitForReady();
    await pool.query(
      `UPDATE whatsapp_message_jobs SET status=$2, provider_message_id=COALESCE($3, provider_message_id), campaign_id=COALESCE($4, campaign_id), last_error=$5, sent_at=COALESCE($6, sent_at) WHERE id=$1`,
      [id, fields.status, fields.providerMessageId || null, fields.campaignId || null, fields.lastError || null, fields.sentAt ? fields.sentAt.toISOString() : null]
    );
  }

  async updateWhatsappJobStatusByProviderMessageId(providerMessageId: string, status: MessageJobStatus, timestampField: "delivered_at" | "read_at"): Promise<WhatsappMessageJob | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `UPDATE whatsapp_message_jobs SET status=$2, ${timestampField}=NOW() WHERE provider_message_id=$1 RETURNING *`,
      [providerMessageId, status]
    );
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async setWhatsappJobStatusByProviderMessageId(providerMessageId: string, status: MessageJobStatus, lastError?: string): Promise<WhatsappMessageJob | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `UPDATE whatsapp_message_jobs SET status=$2, last_error=COALESCE($3, last_error) WHERE provider_message_id=$1 RETURNING *`,
      [providerMessageId, status, lastError || null]
    );
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async countWhatsappMessagesToday(phone: string): Promise<number> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT COUNT(*) as count FROM whatsapp_message_jobs WHERE phone=$1 AND sent_at >= date_trunc('day', NOW()) AND status IN ('sent','delivered','read')`,
      [phone]
    );
    return Number(rows[0]?.count || 0);
  }

  async getLastSentWhatsappMessage(phone: string): Promise<WhatsappMessageJob | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(
      `SELECT * FROM whatsapp_message_jobs WHERE phone=$1 AND sent_at IS NOT NULL ORDER BY sent_at DESC LIMIT 1`,
      [phone]
    );
    return rows[0] ? mapJob(rows[0]) : undefined;
  }

  async getWhatsappMessageJobs(filters: { status?: string; ruleId?: string; entityId?: string; limit?: number; offset?: number }): Promise<{ data: WhatsappMessageJob[]; total: number }> {
    await this.waitForReady();
    const clauses: string[] = [];
    const params: any[] = [];
    if (filters.status) { params.push(filters.status); clauses.push(`j.status = $${params.length}`); }
    if (filters.ruleId) { params.push(filters.ruleId); clauses.push(`j.rule_id = $${params.length}`); }
    if (filters.entityId) { params.push(filters.entityId); clauses.push(`j.entity_id = $${params.length}`); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = filters.limit ?? 50;
    const offset = filters.offset ?? 0;
    const { rows } = await pool.query(
      `SELECT j.*, r.name as rule_name, t.name as template_name, COALESCE(l.name, p.name, ap_p.name) as entity_name
       FROM whatsapp_message_jobs j
       LEFT JOIN whatsapp_automation_rules r ON r.id = j.rule_id
       LEFT JOIN whatsapp_templates t ON t.template_id = j.template_id
       LEFT JOIN leads l ON j.entity_type = 'lead' AND l.id::text = j.entity_id
       LEFT JOIN patients p ON j.entity_type = 'patient' AND p.id::text = j.entity_id
       LEFT JOIN appointments ap ON j.entity_type = 'appointment' AND ap.id::text = j.entity_id
       LEFT JOIN patients ap_p ON ap.patient_id = ap_p.id
       ${where}
       ORDER BY j.scheduled_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
    const { rows: countRows } = await pool.query(`SELECT COUNT(*) as count FROM whatsapp_message_jobs j ${where}`, params);
    return { data: rows.map(mapJob), total: Number(countRows[0]?.count || 0) };
  }

  // ---- Conversation window state ----
  async getConversationSession(phone: string): Promise<WhatsappConversationSession | undefined> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT * FROM whatsapp_conversation_sessions WHERE phone=$1`, [phone]);
    return rows[0] ? mapConversationSession(rows[0]) : undefined;
  }

  async recordOutboundMessage(phone: string): Promise<void> {
    await this.waitForReady();
    await pool.query(
      `INSERT INTO whatsapp_conversation_sessions (phone, last_outbound_at, status)
       VALUES ($1, NOW(), 'closed')
       ON CONFLICT (phone) DO UPDATE SET last_outbound_at = NOW()`,
      [phone]
    );
  }

  async recordInboundMessage(phone: string): Promise<void> {
    await this.waitForReady();
    await pool.query(
      `INSERT INTO whatsapp_conversation_sessions (phone, last_inbound_at, window_expires_at, status)
       VALUES ($1, NOW(), NOW() + INTERVAL '24 hours', 'open')
       ON CONFLICT (phone) DO UPDATE SET last_inbound_at = NOW(), window_expires_at = NOW() + INTERVAL '24 hours', status = 'open'`,
      [phone]
    );
  }

  async isConversationWindowOpen(phone: string): Promise<boolean> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT 1 FROM whatsapp_conversation_sessions WHERE phone=$1 AND window_expires_at > NOW()`, [phone]);
    return rows.length > 0;
  }

  // ---- Opt-outs ----
  async isOptedOut(phone: string): Promise<boolean> {
    await this.waitForReady();
    const { rows } = await pool.query(`SELECT 1 FROM whatsapp_opt_outs WHERE phone=$1`, [phone]);
    return rows.length > 0;
  }

  async addWhatsappOptOut(phone: string, source: string): Promise<void> {
    await this.waitForReady();
    await pool.query(`INSERT INTO whatsapp_opt_outs (phone, source) VALUES ($1,$2) ON CONFLICT (phone) DO NOTHING`, [phone, source]);
  }

  // ---- Audit log ----
  async logWhatsappAudit(action: string, ruleId: string | undefined, userId: string, username: string, detail: Record<string, any>): Promise<void> {
    await this.waitForReady();
    await pool.query(
      `INSERT INTO whatsapp_automation_audit_log (id, action, rule_id, user_id, username, detail) VALUES ($1,$2,$3,$4,$5,$6)`,
      [randomUUID(), action, ruleId || null, userId, username, JSON.stringify(detail || {})]
    );
  }

  async getWhatsappAuditLog(ruleId?: string, limit = 100): Promise<any[]> {
    await this.waitForReady();
    const { rows } = ruleId
      ? await pool.query(`SELECT * FROM whatsapp_automation_audit_log WHERE rule_id=$1 ORDER BY created_at DESC LIMIT $2`, [ruleId, limit])
      : await pool.query(`SELECT * FROM whatsapp_automation_audit_log ORDER BY created_at DESC LIMIT $1`, [limit]);
    return rows.map((r) => ({
      id: normalizeId(r.id),
      action: r.action,
      ruleId: r.rule_id ? normalizeId(r.rule_id) : undefined,
      userId: r.user_id,
      username: r.username,
      detail: parseJsonColumn(r.detail, {}),
      createdAt: r.created_at,
    }));
  }

  // ---- Webhook events (raw safety net) ----
  async storeWhatsappWebhookEvent(payload: any): Promise<string> {
    await this.waitForReady();
    const id = randomUUID();
    await pool.query(`INSERT INTO whatsapp_webhook_events (id, payload) VALUES ($1,$2)`, [id, JSON.stringify(payload)]);
    return id;
  }

  async markWhatsappWebhookProcessed(id: string, note: string): Promise<void> {
    await this.waitForReady();
    await pool.query(`UPDATE whatsapp_webhook_events SET processed=true, note=$2 WHERE id=$1`, [id, note]);
  }

  // ---- Dashboard ----
  async getWhatsappDashboardStats(): Promise<WhatsappDashboardStats> {
    await this.waitForReady();
    const [activeRuleRes, todayRes, pendingRes, scheduledRes, repliesRes, perRuleRes] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count FROM whatsapp_automation_rules WHERE status='Active'`),
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE sent_at >= date_trunc('day', NOW())) as sent,
          COUNT(*) FILTER (WHERE delivered_at >= date_trunc('day', NOW())) as delivered,
          COUNT(*) FILTER (WHERE read_at >= date_trunc('day', NOW())) as read,
          COUNT(*) FILTER (WHERE status='failed' AND scheduled_at >= date_trunc('day', NOW())) as failed
        FROM whatsapp_message_jobs
      `),
      pool.query(`SELECT COUNT(*) as count FROM whatsapp_message_jobs WHERE status IN ('pending','queued')`),
      pool.query(`SELECT COUNT(*) as count FROM whatsapp_message_jobs WHERE status='queued' AND scheduled_at > NOW()`),
      pool.query(`SELECT COUNT(*) as count FROM whatsapp_conversation_sessions WHERE last_inbound_at >= date_trunc('day', NOW())`),
      pool.query(`
        SELECT r.id, r.name, r.status,
          COUNT(DISTINCT run.id) as triggered,
          COUNT(j.id) FILTER (WHERE j.status IN ('sent','delivered','read')) as sent,
          COUNT(j.id) FILTER (WHERE j.status IN ('delivered','read')) as delivered,
          COUNT(j.id) FILTER (WHERE j.status='read') as read,
          COUNT(j.id) FILTER (WHERE j.status='failed') as failed
        FROM whatsapp_automation_rules r
        LEFT JOIN whatsapp_automation_runs run ON run.rule_id = r.id
        LEFT JOIN whatsapp_message_jobs j ON j.rule_id = r.id
        GROUP BY r.id, r.name, r.status
        ORDER BY r.created_at DESC
      `),
    ]);

    return {
      activeRules: Number(activeRuleRes.rows[0]?.count || 0),
      sentToday: Number(todayRes.rows[0]?.sent || 0),
      deliveredToday: Number(todayRes.rows[0]?.delivered || 0),
      readToday: Number(todayRes.rows[0]?.read || 0),
      failedToday: Number(todayRes.rows[0]?.failed || 0),
      pending: Number(pendingRes.rows[0]?.count || 0),
      scheduled: Number(scheduledRes.rows[0]?.count || 0),
      repliesToday: Number(repliesRes.rows[0]?.count || 0),
      perRule: perRuleRes.rows.map((r) => ({
        ruleId: normalizeId(r.id),
        ruleName: r.name,
        status: r.status,
        triggered: Number(r.triggered || 0),
        sent: Number(r.sent || 0),
        delivered: Number(r.delivered || 0),
        read: Number(r.read || 0),
        failed: Number(r.failed || 0),
        replies: 0,
      })),
    };
  }
}

export const storage = new PostgresStorage();

