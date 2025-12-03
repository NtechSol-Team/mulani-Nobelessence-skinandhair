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
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Patients
  getPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | undefined>;
  createPatient(patient: InsertPatient): Promise<Patient>;
  
  // Visits
  getVisits(): Promise<Visit[]>;
  getVisitsByPatient(patientId: string): Promise<Visit[]>;
  createVisit(visit: InsertVisit): Promise<Visit>;
  
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
  updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined>;
  
  // Expenses
  getExpenses(): Promise<Expense[]>;
  getExpense(id: string): Promise<Expense | undefined>;
  createExpense(expense: InsertExpense): Promise<Expense>;
  updateExpense(id: string, expense: InsertExpense): Promise<Expense | undefined>;
  deleteExpense(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private patients: Map<string, Patient>;
  private visits: Map<string, Visit>;
  private medicines: Map<string, Medicine>;
  private treatments: Map<string, Treatment>;
  private bills: Map<string, Bill>;
  private expenses: Map<string, Expense>;
  private visitCounter: Map<string, number>;

  constructor() {
    this.patients = new Map();
    this.visits = new Map();
    this.medicines = new Map();
    this.treatments = new Map();
    this.bills = new Map();
    this.expenses = new Map();
    this.visitCounter = new Map();
  }

  // Patients
  async getPatients(): Promise<Patient[]> {
    return Array.from(this.patients.values());
  }

  async getPatient(id: string): Promise<Patient | undefined> {
    return this.patients.get(id);
  }

  async createPatient(insertPatient: InsertPatient): Promise<Patient> {
    const id = randomUUID();
    const patient: Patient = { ...insertPatient, id };
    this.patients.set(id, patient);
    this.visitCounter.set(id, 0);
    return patient;
  }

  // Visits
  async getVisits(): Promise<Visit[]> {
    return Array.from(this.visits.values());
  }

  async getVisitsByPatient(patientId: string): Promise<Visit[]> {
    return Array.from(this.visits.values()).filter(
      (visit) => visit.patientId === patientId
    );
  }

  async createVisit(insertVisit: InsertVisit): Promise<Visit> {
    const id = randomUUID();
    const currentCount = this.visitCounter.get(insertVisit.patientId) || 0;
    const visitNumber = currentCount + 1;
    this.visitCounter.set(insertVisit.patientId, visitNumber);
    
    const visit: Visit = { ...insertVisit, id, visitNumber };
    this.visits.set(id, visit);
    return visit;
  }

  // Medicines
  async getMedicines(): Promise<Medicine[]> {
    return Array.from(this.medicines.values());
  }

  async getMedicine(id: string): Promise<Medicine | undefined> {
    return this.medicines.get(id);
  }

  async createMedicine(insertMedicine: InsertMedicine): Promise<Medicine> {
    const id = randomUUID();
    const medicine: Medicine = { ...insertMedicine, id };
    this.medicines.set(id, medicine);
    return medicine;
  }

  async updateMedicine(id: string, insertMedicine: InsertMedicine): Promise<Medicine | undefined> {
    const existing = this.medicines.get(id);
    if (!existing) return undefined;
    
    const medicine: Medicine = { ...insertMedicine, id };
    this.medicines.set(id, medicine);
    return medicine;
  }

  async deleteMedicine(id: string): Promise<boolean> {
    return this.medicines.delete(id);
  }

  async updateMedicineStock(id: string, quantityChange: number): Promise<Medicine | undefined> {
    const medicine = this.medicines.get(id);
    if (!medicine) return undefined;
    
    medicine.quantity = Math.max(0, medicine.quantity + quantityChange);
    this.medicines.set(id, medicine);
    return medicine;
  }

  // Treatments
  async getTreatments(): Promise<Treatment[]> {
    return Array.from(this.treatments.values());
  }

  async getTreatment(id: string): Promise<Treatment | undefined> {
    return this.treatments.get(id);
  }

  async createTreatment(insertTreatment: InsertTreatment): Promise<Treatment> {
    const id = randomUUID();
    const treatment: Treatment = { ...insertTreatment, id };
    this.treatments.set(id, treatment);
    return treatment;
  }

  async updateTreatment(id: string, insertTreatment: InsertTreatment): Promise<Treatment | undefined> {
    const existing = this.treatments.get(id);
    if (!existing) return undefined;
    
    const treatment: Treatment = { ...insertTreatment, id };
    this.treatments.set(id, treatment);
    return treatment;
  }

  async deleteTreatment(id: string): Promise<boolean> {
    return this.treatments.delete(id);
  }

  // Bills
  async getBills(): Promise<Bill[]> {
    return Array.from(this.bills.values());
  }

  async getBill(id: string): Promise<Bill | undefined> {
    return this.bills.get(id);
  }

  async createBill(insertBill: InsertBill, patientName: string): Promise<Bill> {
    const id = randomUUID();
    const pendingAmount = insertBill.grandTotal - insertBill.amountPaid;
    
    const bill: Bill = {
      ...insertBill,
      id,
      patientName,
      pendingAmount,
    };
    this.bills.set(id, bill);
    return bill;
  }

  async updateBillPayment(id: string, amountPaid: number): Promise<Bill | undefined> {
    const bill = this.bills.get(id);
    if (!bill) return undefined;
    
    bill.amountPaid = amountPaid;
    bill.pendingAmount = Math.max(0, bill.grandTotal - amountPaid);
    this.bills.set(id, bill);
    return bill;
  }

  // Expenses
  async getExpenses(): Promise<Expense[]> {
    return Array.from(this.expenses.values());
  }

  async getExpense(id: string): Promise<Expense | undefined> {
    return this.expenses.get(id);
  }

  async createExpense(insertExpense: InsertExpense): Promise<Expense> {
    const id = randomUUID();
    const expense: Expense = { ...insertExpense, id };
    this.expenses.set(id, expense);
    return expense;
  }

  async updateExpense(id: string, insertExpense: InsertExpense): Promise<Expense | undefined> {
    const existing = this.expenses.get(id);
    if (!existing) return undefined;
    
    const expense: Expense = { ...insertExpense, id };
    this.expenses.set(id, expense);
    return expense;
  }

  async deleteExpense(id: string): Promise<boolean> {
    return this.expenses.delete(id);
  }
}

export const storage = new MemStorage();
