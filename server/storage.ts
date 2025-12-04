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
  
  // Bills
  getBills(): Promise<Bill[]>;
  getBill(id: string): Promise<Bill | undefined>;
  createBill(bill: InsertBill, patientName: string): Promise<Bill>;
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
}

type DbPatientRow = {
  id: string | number;
  name: string;
  phone: string;
  registration_date: string;
};

type DbVisitRow = {
  id: string | number;
  patient_id: string | number;
  date: string;
  complaints: string;
  diagnosis: string;
  visit_number: number;
};

type DbMedicineRow = {
  id: string | number;
  name: string;
  purchase_cost: number;
  selling_price: number;
  quantity: number;
};

type DbTreatmentRow = {
  id: string | number;
  name: string;
  default_price: number;
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

const createTableStatements = [
  `CREATE TABLE IF NOT EXISTS patients (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    registration_date TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS visits (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    date TEXT NOT NULL,
    complaints TEXT NOT NULL,
    diagnosis TEXT NOT NULL,
    visit_number INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS visits_patient_idx ON visits(patient_id)`,
  `CREATE TABLE IF NOT EXISTS medicines (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    purchase_cost DOUBLE PRECISION NOT NULL,
    selling_price DOUBLE PRECISION NOT NULL,
    quantity INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS treatments (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    default_price DOUBLE PRECISION NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bills (
    id BIGSERIAL PRIMARY KEY,
    patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    date TEXT NOT NULL,
    treatments JSONB NOT NULL,
    medicines JSONB NOT NULL,
    treatment_total DOUBLE PRECISION NOT NULL,
    medicine_total DOUBLE PRECISION NOT NULL,
    grand_total DOUBLE PRECISION NOT NULL,
    amount_paid DOUBLE PRECISION NOT NULL,
    pending_amount DOUBLE PRECISION NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS bills_patient_idx ON bills(patient_id)`,
  `CREATE TABLE IF NOT EXISTS expenses (
    id BIGSERIAL PRIMARY KEY,
    description TEXT NOT NULL,
    amount DOUBLE PRECISION NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL
  )`,
];

async function ensureTables(): Promise<void> {
  for (const statement of createTableStatements) {
    await pool.query(statement);
  }
}

class DataCache {
  private store = new Map<string, { value: unknown; expires: number }>();
  constructor(private ttlMs: number) {}

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

type EntityTable = "patients" | "visits" | "medicines" | "treatments" | "bills" | "expenses";
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
  const tables: EntityTable[] = ["patients", "visits", "medicines", "treatments", "bills", "expenses"];
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

const mapPatient = (row: DbPatientRow): Patient => ({
  id: normalizeId(row.id),
  name: row.name,
  phone: row.phone,
  registrationDate: row.registration_date,
});

const mapVisit = (row: DbVisitRow): Visit => ({
  id: normalizeId(row.id),
  patientId: normalizeId(row.patient_id),
  date: row.date,
  complaints: row.complaints,
  diagnosis: row.diagnosis,
  visitNumber: row.visit_number,
});

const mapMedicine = (row: DbMedicineRow): Medicine => ({
  id: normalizeId(row.id),
  name: row.name,
  purchaseCost: row.purchase_cost,
  sellingPrice: row.selling_price,
  quantity: row.quantity,
});

const mapTreatment = (row: DbTreatmentRow): Treatment => ({
  id: normalizeId(row.id),
  name: row.name,
  defaultPrice: row.default_price,
});

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

  return {
    id: normalizeId(row.id),
    patientId: normalizeId(row.patient_id),
    patientName: row.patient_name,
    date: row.date,
    treatments,
    medicines,
    treatmentTotal: row.treatment_total,
    medicineTotal: row.medicine_total,
    grandTotal: row.grand_total,
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

export class PostgresStorage implements IStorage {
  private ready: Promise<void>;
  private idModes: Record<EntityTable, IdMode> = {
    patients: "text",
    visits: "text",
    medicines: "text",
    treatments: "text",
    bills: "text",
    expenses: "text",
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
    return this.idModes[table] === "numeric";
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
      "SELECT id, name, phone, registration_date FROM patients ORDER BY registration_date DESC"
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
      "SELECT id, name, phone, registration_date FROM patients WHERE id = $1",
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
      ? `INSERT INTO patients (name, phone, registration_date)
         VALUES ($1, $2, $3)
         RETURNING id, name, phone, registration_date`
      : `INSERT INTO patients (id, name, phone, registration_date)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, phone, registration_date`;
    const params = useNumericId
      ? [insertPatient.name, insertPatient.phone, insertPatient.registrationDate]
      : [randomUUID(), insertPatient.name, insertPatient.phone, insertPatient.registrationDate];
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
       SET name = $1, phone = $2, registration_date = $3
       WHERE id = $4
       RETURNING id, name, phone, registration_date`,
      [insertPatient.name, insertPatient.phone, insertPatient.registrationDate, id]
    );
    const patient = rows[0] ? mapPatient(rows[0]) : undefined;
    if (patient) {
      this.cache.invalidate("patients");
      this.cache.invalidate("patient:");
    }
    return patient;
  }

  // Visits
  async getVisits(): Promise<Visit[]> {
    await this.waitForReady();
    const cached = this.cache.get<Visit[]>("visits:all");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbVisitRow>(
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number FROM visits ORDER BY date DESC, visit_number DESC"
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
      "SELECT id, patient_id, date, complaints, diagnosis, visit_number FROM visits WHERE patient_id = $1 ORDER BY visit_number DESC",
      [dbPatientId]
    );
    const visits = rows.map(mapVisit);
    this.cache.set(cacheKey, visits);
    return visits;
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    await this.waitForReady();
    const patientIdValue = this.convertId("patients", insertVisit.patientId);
    const [{ visit_number }] = (
      await pool.query<{ visit_number: number }>(
        `SELECT COALESCE(MAX(visit_number), 0) + 1 AS visit_number
         FROM visits
         WHERE patient_id = $1`,
        [patientIdValue]
      )
    ).rows;

    const visitNumber = Number(visit_number ?? 1);
    const usesNumericVisitId = this.usesNumericId("visits");
    const insertQuery = usesNumericVisitId
      ? `INSERT INTO visits (patient_id, date, complaints, diagnosis, visit_number)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, patient_id, date, complaints, diagnosis, visit_number`
      : `INSERT INTO visits (id, patient_id, date, complaints, diagnosis, visit_number)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, patient_id, date, complaints, diagnosis, visit_number`;
    const insertParams = usesNumericVisitId
      ? [patientIdValue, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis, visitNumber]
      : [
          randomUUID(),
          patientIdValue,
          insertVisit.date,
          insertVisit.complaints,
          insertVisit.diagnosis,
          visitNumber,
        ];
    const { rows } = await pool.query<DbVisitRow>(insertQuery, insertParams);
    const visit = mapVisit(rows[0]);
    this.cache.invalidate("visits");
    this.cache.invalidate(`visits:patient:${normalizeId(insertVisit.patientId)}`);
    return visit;
  }

  async updateVisit(id: string, insertVisit: InsertVisit): Promise<Visit | undefined> {
    await this.waitForReady();
    const dbVisitId = this.convertId("visits", id);
    const { rows } = await pool.query<DbVisitRow>(
      `UPDATE visits
       SET date = $2,
           complaints = $3,
           diagnosis = $4
       WHERE id = $1
       RETURNING id, patient_id, date, complaints, diagnosis, visit_number`,
      [dbVisitId, insertVisit.date, insertVisit.complaints, insertVisit.diagnosis]
    );
    const visit = rows[0] ? mapVisit(rows[0]) : undefined;
    if (visit) {
      this.cache.invalidate("visits");
      this.cache.invalidate(`visits:patient:${visit.patientId}`);
    }
    return visit;
  }

  // Medicines
  async getMedicines(): Promise<Medicine[]> {
    await this.waitForReady();
    const cached = this.cache.get<Medicine[]>("medicines");
    if (cached) {
      return cached;
    }
    const { rows } = await pool.query<DbMedicineRow>(
      "SELECT id, name, purchase_cost, selling_price, quantity FROM medicines ORDER BY name ASC"
    );
    const medicines = rows.map(mapMedicine);
    this.cache.set("medicines", medicines);
    return medicines;
  }

  async getMedicine(id: string): Promise<Medicine | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `medicine:${normalizedId}`;
    const cached = this.cache.get<Medicine>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("medicines", id);
    const { rows } = await pool.query<DbMedicineRow>(
      "SELECT id, name, purchase_cost, selling_price, quantity FROM medicines WHERE id = $1",
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
      ? `INSERT INTO medicines (name, purchase_cost, selling_price, quantity)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, purchase_cost, selling_price, quantity`
      : `INSERT INTO medicines (id, name, purchase_cost, selling_price, quantity)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, purchase_cost, selling_price, quantity`;
    const params = useNumericId
      ? [insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity]
      : [
          randomUUID(),
          insertMedicine.name,
          insertMedicine.purchaseCost,
          insertMedicine.sellingPrice,
          insertMedicine.quantity,
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
           quantity = $5
       WHERE id = $1
       RETURNING id, name, purchase_cost, selling_price, quantity`,
      [dbId, insertMedicine.name, insertMedicine.purchaseCost, insertMedicine.sellingPrice, insertMedicine.quantity]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id}`);
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
      this.cache.invalidate(`medicine:${normalizeId(id)}`);
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
       RETURNING id, name, purchase_cost, selling_price, quantity`,
      [dbId, quantityChange]
    );
    const medicine = rows[0] ? mapMedicine(rows[0]) : undefined;
    if (medicine) {
      this.cache.invalidate("medicines");
      this.cache.invalidate(`medicine:${medicine.id}`);
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
      "SELECT id, name, default_price FROM treatments ORDER BY name ASC"
    );
    const treatments = rows.map(mapTreatment);
    this.cache.set("treatments", treatments);
    return treatments;
  }

  async getTreatment(id: string): Promise<Treatment | undefined> {
    await this.waitForReady();
    const normalizedId = normalizeId(id);
    const cacheKey = `treatment:${normalizedId}`;
    const cached = this.cache.get<Treatment>(cacheKey);
    if (cached) {
      return cached;
    }
    const dbId = this.convertId("treatments", id);
    const { rows } = await pool.query<DbTreatmentRow>(
      "SELECT id, name, default_price FROM treatments WHERE id = $1",
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
      ? `INSERT INTO treatments (name, default_price)
         VALUES ($1, $2)
         RETURNING id, name, default_price`
      : `INSERT INTO treatments (id, name, default_price)
         VALUES ($1, $2, $3)
         RETURNING id, name, default_price`;
    const params = useNumericId
      ? [insertTreatment.name, insertTreatment.defaultPrice]
      : [randomUUID(), insertTreatment.name, insertTreatment.defaultPrice];
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
           default_price = $3
       WHERE id = $1
       RETURNING id, name, default_price`,
      [dbId, insertTreatment.name, insertTreatment.defaultPrice]
    );
    const treatment = rows[0] ? mapTreatment(rows[0]) : undefined;
    if (treatment) {
      this.cache.invalidate("treatments");
      this.cache.invalidate(`treatment:${treatment.id}`);
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
      this.cache.invalidate(`treatment:${normalizeId(id)}`);
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
              treatment_total, medicine_total, grand_total, amount_paid, pending_amount
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
              treatment_total, medicine_total, grand_total, amount_paid, pending_amount
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
      const pendingAmount = Math.max(0, insertBill.grandTotal - insertBill.amountPaid);
      const useNumericId = this.usesNumericId("bills");
      const query = useNumericId
        ? `INSERT INTO bills (
          patient_id,
          patient_name,
          date,
          treatments,
          medicines,
          treatment_total,
          medicine_total,
          grand_total,
          amount_paid,
          pending_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
                  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`
        : `INSERT INTO bills (
          id,
          patient_id,
          patient_name,
          date,
          treatments,
          medicines,
          treatment_total,
          medicine_total,
          grand_total,
          amount_paid,
          pending_amount
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, patient_id, patient_name, date, treatments, medicines,
                  treatment_total, medicine_total, grand_total, amount_paid, pending_amount`;
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

  async updateBill(id: string, insertBill: InsertBill, patientName: string): Promise<Bill | undefined> {
    await this.waitForReady();
    const dbId = this.convertId("bills", id);
    const pendingAmount = Math.max(0, insertBill.grandTotal - insertBill.amountPaid);
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
           amount_paid = $10,
           pending_amount = $11
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
                 treatment_total, medicine_total, grand_total, amount_paid, pending_amount`,
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
        insertBill.amountPaid,
        pendingAmount,
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
           pending_amount = GREATEST(0, grand_total - $2)
       WHERE id = $1
       RETURNING id, patient_id, patient_name, date, treatments, medicines,
                 treatment_total, medicine_total, grand_total, amount_paid, pending_amount`,
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
    const cacheKey = `expense:${normalizedId}`;
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
      ? `INSERT INTO expenses (description, amount, date, category)
         VALUES ($1, $2, $3, $4)
         RETURNING id, description, amount, date, category`
      : `INSERT INTO expenses (id, description, amount, date, category)
         VALUES ($1, $2, $3, $4, $5)
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
      this.cache.invalidate(`expense:${expense.id}`);
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
      this.cache.invalidate(`expense:${normalizeId(id)}`);
    }
    return success;
  }
}

export const storage = new PostgresStorage();
