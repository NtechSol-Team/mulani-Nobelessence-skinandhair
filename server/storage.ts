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
} from "@shared/schema";
import { randomUUID } from "crypto";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false,
  },
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
  // Authentication removed
}

// User table and auth-related types removed

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
    status TEXT NOT NULL
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
];

async function ensureTables(): Promise<void> {
  for (const statement of createTableStatements) {
    await pool.query(statement);
  }
  // Migration for new time column
  await pool.query("ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time TEXT DEFAULT ''");

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

type EntityTable = "patients" | "visits" | "medicines" | "treatments" | "bills" | "expenses" | "appointments" | "payment_ledger" | "leads" | "crm_interactions" | "crm_tasks" | "departments";
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
  const tables: EntityTable[] = ["patients", "visits", "medicines", "treatments", "bills", "expenses", "appointments", "payment_ledger", "leads", "crm_interactions", "crm_tasks", "departments"];
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

// mapUser removed

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
});

const mapPaymentLedger = (row: DbPaymentLedgerRow): PaymentLedger => ({
  id: normalizeId(row.id),
  billId: normalizeId(row.bill_id),
  patientId: normalizeId(row.patient_id),
  amount: row.amount,
  date: row.date,
  paymentMode: (row.payment_mode || "Cash") as "Cash" | "Online",
});

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
            treatment_total, medicine_total, grand_total, discount, final_amount, amount_paid, pending_amount
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
            treatment_total, medicine_total, grand_total, discount, final_amount, amount_paid, pending_amount
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
                throw new Error(`Surgery equipment item with ID ${eq.medicineId} not found`);
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
      this.cache.invalidate("bills");
      this.cache.invalidate(`bill:${bill.id}`);
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
            treatment_total, medicine_total, grand_total, discount, final_amount, amount_paid, pending_amount`,
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
            treatment_total, medicine_total, grand_total, discount, final_amount, amount_paid, pending_amount
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
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status 
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
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status 
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
      `SELECT a.id, a.patient_id, p.name as patient_name, a.date, a.time, a.reason, a.status 
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
      ? `INSERT INTO appointments(patient_id, date, time, reason, status)
         VALUES($1, $2, $3, $4, $5)
         RETURNING id, patient_id, date, time, reason, status`
      : `INSERT INTO appointments(id, patient_id, date, time, reason, status)
         VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id, patient_id, date, time, reason, status`;

    const dbPatientId = this.convertId("patients", insert.patientId);

    const params = useNumericId
      ? [dbPatientId, insert.date, insert.time, insert.reason, insert.status]
      : [randomUUID(), dbPatientId, insert.date, insert.time, insert.reason, insert.status];

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
       SET patient_id = $2, date = $3, time = $4, reason = $5, status = $6
       WHERE id = $1
       RETURNING id, patient_id, date, time, reason, status`,
      [dbId, dbPatientId, insert.date, insert.time, insert.reason, insert.status]
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

  // Users/Auth
  // Authentication methods removed
}

export const storage = new PostgresStorage();

