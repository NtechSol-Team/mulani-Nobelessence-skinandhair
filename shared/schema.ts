import { z } from "zod";

// Patient Schema
export interface Patient {
  id: string;
  name: string;
  phone: string;
  registrationDate: string;
}

export const insertPatientSchema = z.object({
  name: z.string().min(1, "Patient name is required"),
  phone: z.string().min(10, "Phone number must be at least 10 digits"),
  registrationDate: z.string(),
});

export type InsertPatient = z.infer<typeof insertPatientSchema>;

// Visit Schema
export interface Visit {
  id: string;
  patientId: string;
  date: string;
  complaints: string;
  diagnosis: string;
  visitNumber: number;
}

export const insertVisitSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  complaints: z.string().min(1, "Complaints are required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
});

export type InsertVisit = z.infer<typeof insertVisitSchema>;

// Medicine Schema
export interface Medicine {
  id: string;
  name: string;
  purchaseCost: number;
  sellingPrice: number;
  quantity: number;
}

export const insertMedicineSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  purchaseCost: z.number().min(0, "Purchase cost must be positive"),
  sellingPrice: z.number().min(0, "Selling price must be positive"),
  quantity: z.number().min(0, "Quantity must be positive"),
});

export type InsertMedicine = z.infer<typeof insertMedicineSchema>;

// Treatment Schema
export interface Treatment {
  id: string;
  name: string;
  defaultPrice: number;
}

export const insertTreatmentSchema = z.object({
  name: z.string().min(1, "Treatment name is required"),
  defaultPrice: z.number().min(0, "Price must be positive"),
});

export type InsertTreatment = z.infer<typeof insertTreatmentSchema>;

// Bill Item for medicines in a bill
export interface BillMedicineItem {
  medicineId: string;
  medicineName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

// Bill Item for treatments in a bill
export interface BillTreatmentItem {
  treatmentId: string;
  treatmentName: string;
  price: number;
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
  })),
  medicines: z.array(z.object({
    medicineId: z.string(),
    medicineName: z.string(),
    quantity: z.number().min(1),
    unitPrice: z.number().min(0),
    total: z.number(),
  })),
  treatmentTotal: z.number(),
  medicineTotal: z.number(),
  grandTotal: z.number(),
  amountPaid: z.number().min(0),
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
