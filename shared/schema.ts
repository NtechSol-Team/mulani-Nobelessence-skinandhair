import { z } from "zod";

// User Schema
export interface User {
  id: string;
  username: string;
  createdAt: string;
}

export const registerSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(50),
  password: z.string().min(6, "Password must be at least 6 characters"),
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
}

export const insertAppointmentSchema = z.object({
  patientId: z.string().min(1, "Patient ID is required"),
  date: z.string(),
  time: z.string().default("09:00"),
  reason: z.string().optional().default(""),
  status: z.enum(["Scheduled", "Completed", "Cancelled"]).default("Scheduled"),
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

