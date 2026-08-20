import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertPatientSchema,
  insertVisitSchema,
  insertMedicineSchema,
  insertTreatmentSchema,
  insertBillSchema,
  insertExpenseSchema,
  paymentAdjustmentSchema,
  insertAppointmentSchema,
  paginationSchema,
  insertLeadSchema,
  insertCRMInteractionSchema,
  insertCRMTaskSchema,
  insertDepartmentSchema,
  registerSchema,
} from "@shared/schema";
import { z } from "zod";

import { ensureAuthenticated, requireSuperAdmin, checkPermission } from "./auth";
import { registerWhatsappWebhookRoute, registerWhatsappRoutes } from "./whatsapp/routes";
import {
  emitLeadCreated,
  emitLeadStatusChanged,
  emitPatientRegistered,
  emitAppointmentBooked,
  emitAppointmentStatusChanged,
} from "./whatsapp/events";

function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Public health check endpoint for keep-alive/pings
  app.get("/api/health", async (req, res) => {
    try {
      await storage.ping();
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    } catch (error) {
      res.status(500).json({ status: "error", error: error instanceof Error ? error.message : String(error) });
    }
  });

  // User Management routes for SuperAdmins
  app.get("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await storage.getUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireSuperAdmin, async (req, res) => {
    try {
      const validated = registerSchema.parse(req.body);
      const existing = await storage.getUserByUsername(validated.username);
      if (existing) {
        return res.status(400).json({ error: "Username already exists" });
      }
      const user = await storage.createUser(validated);
      res.status(201).json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const validated = registerSchema.partial().parse(req.body);
      const user = await storage.updateUser(req.params.id, validated);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.delete("/api/users/:id", requireSuperAdmin, async (req, res) => {
    try {
      const success = await storage.deleteUser(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "User not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Public webhook for the QuickAuth WhatsApp provider (no session auth - the
  // provider calls this server-to-server). Must stay before the auth gate below.
  registerWhatsappWebhookRoute(app);

  // Protect all API routes registered below
  // Note: /api/login and /api/logout are registered in setupAuth() before this function
  app.use("/api", ensureAuthenticated);

  // ==================== PATIENTS ====================

  app.get("/api/patients", checkPermission("patients", "view"), async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getPatientsPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch patients" });
    }
  });

  app.get("/api/patients/:id", checkPermission("patients", "view"), async (req, res) => {
    try {
      const patient = await storage.getPatient(req.params.id);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.json(patient);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch patient" });
    }
  });

  app.post("/api/patients", checkPermission("patients", "add"), async (req, res) => {
    try {
      const validated = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validated);
      emitPatientRegistered(patient);
      res.status(201).json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", checkPermission("patients", "edit"), async (req, res) => {
    try {
      const validated = insertPatientSchema.parse(req.body);
      const patient = await storage.updatePatient(req.params.id, validated);
      if (!patient) {
        return res.status(404).json({ error: "Patient not found" });
      }
      // Update all related bills with the new patient name
      await storage.updatePatientBillsName(req.params.id, patient.name);
      res.json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update patient" });
    }
  });

  app.delete("/api/patients/:id", checkPermission("patients", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deletePatient(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Patient not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete patient" });
    }
  });

  // ==================== VISITS ====================

  app.get("/api/visits", checkPermission("patients", "view"), async (req, res) => {
    try {
      const visits = await storage.getVisits();
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  app.get("/api/visits/:patientId", checkPermission("patients", "view"), async (req, res) => {
    try {
      const visits = await storage.getVisitsByPatient(req.params.patientId);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  app.post("/api/visits", checkPermission("patients", "edit"), async (req, res) => {
    try {
      const validated = insertVisitSchema.parse(req.body);
      const visit = await storage.createVisit(validated);
      res.status(201).json(visit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create visit" });
    }
  });

  app.patch("/api/visits/:id", checkPermission("patients", "edit"), async (req, res) => {
    try {
      const validated = insertVisitSchema.parse(req.body);
      const visit = await storage.updateVisit(req.params.id, validated);
      if (!visit) {
        return res.status(404).json({ error: "Visit not found" });
      }
      res.json(visit);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update visit" });
    }
  });

  // ==================== MEDICINES ====================
  app.get("/api/medicines", checkPermission("medicines", "view"), async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getMedicinesPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch medicines" });
    }
  });

  app.get("/api/medicines/:id", checkPermission("medicines", "view"), async (req, res) => {
    try {
      const medicine = await storage.getMedicine(req.params.id);
      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.json(medicine);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch medicine" });
    }
  });

  app.post("/api/medicines", checkPermission("medicines", "add"), async (req, res) => {
    try {
      const validated = insertMedicineSchema.parse(req.body);
      const medicine = await storage.createMedicine(validated);
      res.status(201).json(medicine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create medicine" });
    }
  });

  app.patch("/api/medicines/:id", checkPermission("medicines", "edit"), async (req, res) => {
    try {
      const validated = insertMedicineSchema.parse(req.body);
      const medicine = await storage.updateMedicine(req.params.id, validated);
      if (!medicine) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.json(medicine);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update medicine" });
    }
  });

  app.delete("/api/medicines/:id", checkPermission("medicines", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteMedicine(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Medicine not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete medicine" });
    }
  });

  // ==================== TREATMENTS ====================
  app.get("/api/treatments", checkPermission("treatments", "view"), async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      try {
        const { data, total } = await storage.getTreatmentsPaginated(limit, offset);
        res.json({ data, total, limit, offset });
      } catch (paginationError) {
        // Fallback to non-paginated method
        console.error("Paginated query failed, using fallback:", paginationError);
        const allTreatments = await storage.getTreatments();
        const data = allTreatments.slice(offset, offset + limit);
        const total = allTreatments.length;
        res.json({ data, total, limit, offset });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Treatments fetch error:", error);
      res.status(500).json({ error: "Failed to fetch treatments" });
    }
  });

  app.get("/api/treatments/:id", checkPermission("treatments", "view"), async (req, res) => {
    try {
      const treatment = await storage.getTreatment(req.params.id);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch treatment" });
    }
  });

  app.post("/api/treatments", checkPermission("treatments", "add"), async (req, res) => {
    try {
      const validated = insertTreatmentSchema.parse(req.body);
      const treatment = await storage.createTreatment(validated);
      res.status(201).json(treatment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create treatment" });
    }
  });

  app.patch("/api/treatments/:id", checkPermission("treatments", "edit"), async (req, res) => {
    try {
      const validated = insertTreatmentSchema.parse(req.body);
      const treatment = await storage.updateTreatment(req.params.id, validated);
      if (!treatment) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.json(treatment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update treatment" });
    }
  });

  app.delete("/api/treatments/:id", checkPermission("treatments", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteTreatment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Treatment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete treatment" });
    }
  });

  // ==================== BILLS ====================

  app.get("/api/bills", checkPermission("billing", "view"), async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getBillsPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch bills" });
    }
  });

  app.get("/api/bills/:id", checkPermission("billing", "view"), async (req, res) => {
    try {
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bill" });
    }
  });

  app.post("/api/bills", checkPermission("billing", "add"), async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);

      // Get patient name
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }

      const bill = await storage.createBillWithStockUpdate(validated, patient.name);

      if (validated.amountPaid > 0) {
        await storage.createPaymentLedgerEntry({
          billId: bill.id,
          patientId: bill.patientId,
          amount: validated.amountPaid,
          date: bill.date,
          paymentMode: validated.paymentMode || "Cash",
        });
      }

      res.status(201).json(bill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      if (error instanceof Error && (error.message.startsWith("Insufficient stock") || error.message.includes("not found"))) {
        return res.status(400).json({ error: error.message });
      }
      console.error("Error creating bill:", error);
      res.status(500).json({ error: "Failed to create bill", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/bills/:id", checkPermission("billing", "edit"), async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);

      // Get patient name
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }

      // Validate all new medicines and new treatments' equipments stock levels first
      const stockAdjustments = new Map<string, number>();

      const existingBill = await storage.getBill(req.params.id);
      if (existingBill) {
        for (const med of existingBill.medicines) {
          stockAdjustments.set(med.medicineId, (stockAdjustments.get(med.medicineId) || 0) + med.quantity);
        }
        for (const t of existingBill.treatments) {
          if (t.equipments) {
            for (const eq of t.equipments) {
              stockAdjustments.set(eq.medicineId, (stockAdjustments.get(eq.medicineId) || 0) + eq.quantity);
            }
          }
        }
      }

      // Populate equipments snapshot and add stock adjustments
      const processedTreatments = [];
      for (const t of validated.treatments) {
        const tRecord = await storage.getTreatment(t.treatmentId);
        const equipments = (tRecord && tRecord.type === "Surgery" && tRecord.equipments)
          ? tRecord.equipments
          : [];
        processedTreatments.push({
          ...t,
          equipments
        });

        for (const eq of equipments) {
          stockAdjustments.set(eq.medicineId, (stockAdjustments.get(eq.medicineId) || 0) - eq.quantity);
        }
      }
      validated.treatments = processedTreatments;

      for (const med of validated.medicines) {
        stockAdjustments.set(med.medicineId, (stockAdjustments.get(med.medicineId) || 0) - med.quantity);
      }

      // Check if any net adjustment causes negative stock levels
      for (const [medicineId, change] of Array.from(stockAdjustments.entries())) {
        if (change < 0) {
          const med = await storage.getMedicine(medicineId);
          const currentQty = med?.quantity || 0;
          if (currentQty + change < 0) {
            return res.status(400).json({
              error: `Insufficient stock for "${med?.name || 'Item'}". Available: ${currentQty}, Required additional: ${Math.abs(change)}`
            });
          }
        }
      }

      // Restore old stock
      if (existingBill) {
        for (const med of existingBill.medicines) {
          await storage.updateMedicineStock(med.medicineId, med.quantity);
        }
        for (const t of existingBill.treatments) {
          if (t.equipments) {
            for (const eq of t.equipments) {
              await storage.updateMedicineStock(eq.medicineId, eq.quantity);
            }
          }
        }
      }

      // Deduct new stock
      for (const t of validated.treatments) {
        if (t.equipments) {
          for (const eq of t.equipments) {
            await storage.updateMedicineStock(eq.medicineId, -eq.quantity);
          }
        }
      }
      for (const med of validated.medicines) {
        await storage.updateMedicineStock(med.medicineId, -med.quantity);
      }

      const bill = await storage.updateBill(req.params.id, validated, patient.name);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update bill" });
    }
  });

  app.patch("/api/bills/:id/payment", checkPermission("billing", "edit"), async (req, res) => {
    try {
      const { addAmount, setAmount, paymentMode } = req.body;

      // Validate incoming numeric values if present
      if (typeof addAmount !== "undefined" && typeof addAmount !== "number") {
        return res.status(400).json({ error: "Invalid addAmount" });
      }
      if (typeof setAmount !== "undefined" && typeof setAmount !== "number") {
        return res.status(400).json({ error: "Invalid setAmount" });
      }

      // Get current bill to calculate new total
      const currentBill = await storage.getBill(req.params.id);
      if (!currentBill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      let newTotalPaid: number;
      let amountAdded = 0;

      // If setAmount is provided, use it as the absolute paid total (allow correcting mistakes)
      if (typeof setAmount === "number") {
        if (setAmount < 0 || setAmount > currentBill.grandTotal) {
          return res.status(400).json({ error: "setAmount must be between 0 and bill total" });
        }
        newTotalPaid = setAmount;
        amountAdded = setAmount - currentBill.amountPaid;
      } else {
        // Otherwise use additive flow (existing behavior)
        const add = typeof addAmount === "number" ? addAmount : undefined;
        if (typeof add === "undefined" || add < 0) {
          return res.status(400).json({ error: "Invalid payment amount" });
        }
        newTotalPaid = currentBill.amountPaid + add;
        amountAdded = add;
        if (newTotalPaid > currentBill.grandTotal) {
          return res.status(400).json({
            error: `Cannot exceed bill amount. Remaining: ₹${(currentBill.grandTotal - currentBill.amountPaid).toFixed(2)}`
          });
        }
      }

      const bill = await storage.updateBillPayment(req.params.id, newTotalPaid);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      if (amountAdded > 0) {
        await storage.createPaymentLedgerEntry({
          billId: bill.id,
          patientId: bill.patientId,
          amount: amountAdded,
          date: getLocalDateString(),
          paymentMode: paymentMode || "Cash",
        });
      }

      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/bills/:id", checkPermission("billing", "delete"), async (req, res) => {
    try {
      const bill = await storage.getBill(req.params.id);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      // Restore medicine stock for deleted bill
      const medicines = Array.isArray(bill.medicines) ? bill.medicines : [];
      for (const med of medicines) {
        if (med && med.medicineId && med.quantity) {
          await storage.updateMedicineStock(med.medicineId, med.quantity);
        }
      }

      // Restore equipment stock for deleted bill's treatments
      const treatments = Array.isArray(bill.treatments) ? bill.treatments : [];
      for (const t of treatments) {
        if (t && t.equipments) {
          for (const eq of t.equipments) {
            if (eq && eq.medicineId && eq.quantity) {
              await storage.updateMedicineStock(eq.medicineId, eq.quantity);
            }
          }
        }
      }

      const deleted = await storage.deleteBill(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Bill not found" });
      }

      res.status(204).send();
    } catch (error) {
      console.error("Delete bill error:", error);
      res.status(500).json({ error: "Failed to delete bill" });
    }
  });

  app.get("/api/payment-ledgers", checkPermission("billing", "view"), async (req, res) => {
    try {
      const ledgers = await storage.getPaymentLedgers();
      res.json(ledgers);
    } catch (error) {
      console.error("Error fetching payment ledgers:", error);
      res.status(500).json({ error: "Failed to fetch payment ledgers" });
    }
  });

  // ==================== EXPENSES ====================
  app.get("/api/expenses", checkPermission("expenses", "view"), async (req, res) => {
    try {
      const { limit, offset } = paginationSchema.parse(req.query);
      const { data, total } = await storage.getExpensesPaginated(limit, offset);
      res.json({ data, total, limit, offset });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to fetch expenses" });
    }
  });

  app.get("/api/expenses/:id", checkPermission("expenses", "view"), async (req, res) => {
    try {
      const expense = await storage.getExpense(req.params.id);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch expense" });
    }
  });

  app.post("/api/expenses", checkPermission("expenses", "add"), async (req, res) => {
    try {
      const validated = insertExpenseSchema.parse(req.body);
      const expense = await storage.createExpense(validated);
      res.status(201).json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create expense" });
    }
  });

  app.patch("/api/expenses/:id", checkPermission("expenses", "edit"), async (req, res) => {
    try {
      const validated = insertExpenseSchema.parse(req.body);
      const expense = await storage.updateExpense(req.params.id, validated);
      if (!expense) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.json(expense);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update expense" });
    }
  });

  app.delete("/api/expenses/:id", checkPermission("expenses", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteExpense(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Expense not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete expense" });
    }
  });

  // ==================== APPOINTMENTS ====================
  app.get("/api/appointments", checkPermission("appointments", "view"), async (req, res) => {
    try {
      const appointments = await storage.getAppointments();
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/patient/:patientId", checkPermission("appointments", "view"), async (req, res) => {
    try {
      const appointments = await storage.getAppointmentsByPatient(req.params.patientId);
      res.json(appointments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointments" });
    }
  });

  app.get("/api/appointments/:id", checkPermission("appointments", "view"), async (req, res) => {
    try {
      const appointment = await storage.getAppointment(req.params.id);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.json(appointment);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch appointment" });
    }
  });

  app.post("/api/appointments", checkPermission("appointments", "add"), async (req, res) => {
    try {
      console.log("Creating appointment with body:", req.body);
      const validated = insertAppointmentSchema.parse(req.body);
      const appointment = await storage.createAppointment(validated);
      emitAppointmentBooked(appointment);
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation error:", JSON.stringify(error.errors));
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create appointment" });
    }
  });

  app.patch("/api/appointments/:id", checkPermission("appointments", "edit"), async (req, res) => {
    try {
      const validated = insertAppointmentSchema.parse(req.body);
      const previous = await storage.getAppointment(req.params.id);
      const appointment = await storage.updateAppointment(req.params.id, validated);
      if (!appointment) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      if (previous) {
        emitAppointmentStatusChanged(appointment, previous.status);
      }
      res.json(appointment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update appointment" });
    }
  });

  app.delete("/api/appointments/:id", checkPermission("appointments", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteAppointment(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Appointment not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete appointment" });
    }
  });

  // ==================== CRM - LEADS ====================
  app.get("/api/crm/leads", checkPermission("crm", "view"), async (req, res) => {
    try {
      const leads = await storage.getLeads();
      res.json(leads);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch leads" });
    }
  });

  app.get("/api/crm/leads/:id", checkPermission("crm", "view"), async (req, res) => {
    try {
      const lead = await storage.getLead(req.params.id);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.json(lead);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lead" });
    }
  });

  app.post("/api/crm/leads", checkPermission("crm", "add"), async (req, res) => {
    try {
      const validated = insertLeadSchema.parse(req.body);
      if (validated.phone) {
        const leads = await storage.getLeads();
        const duplicate = leads.find(l => l.phone === validated.phone);
        if (duplicate) {
          return res.status(400).json({ error: `A lead with the phone number ${validated.phone} already exists (Name: ${duplicate.name}).` });
        }
      }
      const lead = await storage.createLead(validated);
      emitLeadCreated(lead);
      res.status(201).json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("ZodError in POST /api/crm/leads:", error.errors);
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error in POST /api/crm/leads:", error);
      res.status(500).json({ error: "Failed to create lead" });
    }
  });

  app.patch("/api/crm/leads/:id", checkPermission("crm", "edit"), async (req, res) => {
    try {
      const validated = insertLeadSchema.parse(req.body);
      if (validated.phone) {
        const leads = await storage.getLeads();
        const duplicate = leads.find(l => l.phone === validated.phone && l.id !== req.params.id);
        if (duplicate) {
          return res.status(400).json({ error: `A lead with the phone number ${validated.phone} already exists (Name: ${duplicate.name}).` });
        }
      }
      const previous = await storage.getLead(req.params.id);
      const lead = await storage.updateLead(req.params.id, validated);
      if (!lead) {
        return res.status(404).json({ error: "Lead not found" });
      }
      if (previous) {
        emitLeadStatusChanged(lead, previous.status);
      }
      res.json(lead);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("ZodError in PATCH /api/crm/leads:", error.errors);
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error in PATCH /api/crm/leads:", error);
      res.status(500).json({ error: "Failed to update lead" });
    }
  });

  app.delete("/api/crm/leads/:id", checkPermission("crm", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteLead(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Lead not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete lead" });
    }
  });

  // ==================== CRM - INTERACTIONS ====================
  app.get("/api/crm/interactions", checkPermission("crm", "view"), async (req, res) => {
    try {
      const patientId = req.query.patientId as string | undefined;
      const leadId = req.query.leadId as string | undefined;
      const interactions = await storage.getInteractions(patientId, leadId);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CRM interactions" });
    }
  });

  app.post("/api/crm/interactions", checkPermission("crm", "add"), async (req, res) => {
    try {
      const validated = insertCRMInteractionSchema.parse(req.body);
      const interaction = await storage.createInteraction(validated);
      res.status(201).json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to log interaction" });
    }
  });

  app.patch("/api/crm/interactions/:id", checkPermission("crm", "edit"), async (req, res) => {
    try {
      const validated = insertCRMInteractionSchema.partial().parse(req.body);
      const interaction = await storage.updateInteraction(req.params.id, validated);
      if (!interaction) {
        return res.status(404).json({ error: "Interaction not found" });
      }
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update interaction" });
    }
  });

  // ==================== CRM - TASKS ====================
  app.get("/api/crm/tasks", checkPermission("crm", "view"), async (req, res) => {
    try {
      const tasks = await storage.getCRMTasks();
      res.json(tasks);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch CRM tasks" });
    }
  });

  app.post("/api/crm/tasks", checkPermission("crm", "add"), async (req, res) => {
    try {
      const validated = insertCRMTaskSchema.parse(req.body);
      const task = await storage.createCRMTask(validated);
      res.status(201).json(task);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create CRM task" });
    }
  });

  app.patch("/api/crm/tasks/:id", checkPermission("crm", "edit"), async (req, res) => {
    try {
      const { status } = req.body;
      if (status !== "Pending" && status !== "Completed") {
        return res.status(400).json({ error: "Invalid status" });
      }
      const task = await storage.updateCRMTaskStatus(req.params.id, status);
      if (!task) {
        return res.status(404).json({ error: "CRM task not found" });
      }
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to update CRM task status" });
    }
  });

  app.delete("/api/crm/tasks/:id", checkPermission("crm", "delete"), async (req, res) => {
    try {
      const deleted = await storage.deleteCRMTask(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "CRM task not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete CRM task" });
    }
  });

  // ==================== CRM - STATS & ANALYTICS ====================
  app.get("/api/crm/stats", checkPermission("crm", "view"), async (req, res) => {
    try {
      const leads = await storage.getLeads();
      const patients = await storage.getPatients();

      // Lead metrics
      const totalLeads = leads.length;
      const convertedLeads = leads.filter(l => l.status === "Converted").length;
      const lostLeads = leads.filter(l => l.status === "Lost").length;
      const activeLeads = totalLeads - convertedLeads - lostLeads;
      const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads) * 100 : 0;

      // Sources breakdown
      const sourcesMap: Record<string, number> = {};
      
      // Count from converted/active leads
      leads.forEach(l => {
        const src = l.source || "Other";
        sourcesMap[src] = (sourcesMap[src] || 0) + 1;
      });
      // Count from registered patients who might not have been leads but had a source
      patients.forEach(p => {
        const src = p.source || "Walk-in";
        // If patient was converted from lead, we already counted their lead source, so avoid double counting
        const isFromLead = leads.some(l => l.convertedPatientId === p.id);
        if (!isFromLead) {
          sourcesMap[src] = (sourcesMap[src] || 0) + 1;
        }
      });

      const sourcesBreakdown = Object.entries(sourcesMap).map(([name, value]) => ({
        name,
        value,
      }));

      // Upcoming birthdays in next 7 days
      const checkUpcomingBirthday = (dobString: string | undefined): boolean => {
        if (!dobString) return false;
        const parts = dobString.split('-');
        if (parts.length < 3) return false;
        const dobMonth = parseInt(parts[1], 10) - 1;
        const dobDay = parseInt(parts[2], 10);
        
        const today = new Date();
        const todayYear = today.getFullYear();
        const compareDate = new Date(todayYear, today.getMonth(), today.getDate());
        
        // Calculate birthday for this year
        let bdayThisYear = new Date(todayYear, dobMonth, dobDay);
        // Calculate birthday for next year (in case the range overlaps the year boundary)
        let bdayNextYear = new Date(todayYear + 1, dobMonth, dobDay);
        
        const diffMsThisYear = bdayThisYear.getTime() - compareDate.getTime();
        const diffMsNextYear = bdayNextYear.getTime() - compareDate.getTime();
        
        const diffDaysThisYear = Math.ceil(diffMsThisYear / (1000 * 60 * 60 * 24));
        const diffDaysNextYear = Math.ceil(diffMsNextYear / (1000 * 60 * 60 * 24));
        
        return (diffDaysThisYear >= 0 && diffDaysThisYear <= 7) || (diffDaysNextYear >= 0 && diffDaysNextYear <= 7);
      };

      const upcomingBirthdays = patients
        .filter(p => p.dob && checkUpcomingBirthday(p.dob))
        .map(p => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          dob: p.dob,
        }));

      res.json({
        totalLeads,
        convertedLeads,
        lostLeads,
        activeLeads,
        conversionRate,
        sourcesBreakdown,
        upcomingBirthdays,
      });
    } catch (error) {
      console.error("CRM stats error:", error);
      res.status(500).json({ error: "Failed to generate CRM stats" });
    }
  });

  // ==================== DEPARTMENTS ====================
  app.get("/api/departments", checkPermission("treatments", "view"), async (req, res) => {
    try {
      const depts = await storage.getDepartments();
      res.json(depts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  app.post("/api/departments", checkPermission("treatments", "add"), async (req, res) => {
    try {
      const validated = insertDepartmentSchema.parse(req.body);
      const dept = await storage.createDepartment(validated);
      res.status(201).json(dept);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create department" });
    }
  });

  app.patch("/api/departments/:id", checkPermission("treatments", "edit"), async (req, res) => {
    try {
      const validated = insertDepartmentSchema.parse(req.body);
      const dept = await storage.updateDepartment(req.params.id, validated);
      if (!dept) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.json(dept);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to update department" });
    }
  });

  app.delete("/api/departments/:id", checkPermission("treatments", "delete"), async (req, res) => {
    try {
      const success = await storage.deleteDepartment(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Department not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete department" });
    }
  });

  // ==================== WHATSAPP AUTOMATION ====================
  registerWhatsappRoutes(app);

  return httpServer;
}
