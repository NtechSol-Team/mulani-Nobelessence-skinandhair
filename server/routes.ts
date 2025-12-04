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
  paginationSchema,
  registerSchema,
  loginSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ==================== AUTH ====================
  
  // User registration disabled - only backend/developer can create users
  app.post("/api/auth/register", async (req, res) => {
    res.status(403).json({ error: "User registration is disabled. Contact administrator to create an account." });
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const valid = await storage.verifyPassword(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      // Create session
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regenerate error:", err);
          return res.status(500).json({ error: "Failed to create session" });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.save((err) => {
          if (err) {
            console.error("Session save error:", err);
            return res.status(500).json({ error: "Failed to save session" });
          }
          res.json({ user });
        });
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Login error:", error);
      res.status(500).json({ error: "Failed to login" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
      }
      res.json({ message: "Logged out successfully" });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session?.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    res.json({ 
      user: { 
        id: req.session.userId, 
        username: req.session.username 
      } 
    });
  });

  // ==================== PATIENTS ====================
  
  app.get("/api/patients", async (req, res) => {
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

  app.get("/api/patients/:id", async (req, res) => {
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

  app.post("/api/patients", async (req, res) => {
    try {
      const validated = insertPatientSchema.parse(req.body);
      const patient = await storage.createPatient(validated);
      res.status(201).json(patient);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      res.status(500).json({ error: "Failed to create patient" });
    }
  });

  app.patch("/api/patients/:id", async (req, res) => {
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

  // ==================== VISITS ====================
  
  app.get("/api/visits", async (req, res) => {
    try {
      const visits = await storage.getVisits();
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  app.get("/api/visits/:patientId", async (req, res) => {
    try {
      const visits = await storage.getVisitsByPatient(req.params.patientId);
      res.json(visits);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch visits" });
    }
  });

  app.post("/api/visits", async (req, res) => {
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

  app.patch("/api/visits/:id", async (req, res) => {
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
  
  app.get("/api/medicines", async (req, res) => {
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

  app.get("/api/medicines/:id", async (req, res) => {
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

  app.post("/api/medicines", async (req, res) => {
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

  app.patch("/api/medicines/:id", async (req, res) => {
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

  app.delete("/api/medicines/:id", async (req, res) => {
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
  
  app.get("/api/treatments", async (req, res) => {
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

  app.get("/api/treatments/:id", async (req, res) => {
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

  app.post("/api/treatments", async (req, res) => {
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

  app.patch("/api/treatments/:id", async (req, res) => {
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

  app.delete("/api/treatments/:id", async (req, res) => {
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
  
  app.get("/api/bills", async (req, res) => {
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

  app.get("/api/bills/:id", async (req, res) => {
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

  app.post("/api/bills", async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);
      
      // Get patient name
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }
      
      // Reduce medicine stock (only if medicines exist)
      if (validated.medicines && validated.medicines.length > 0) {
        for (const med of validated.medicines) {
          if (med.medicineId) {
            const medicine = await storage.getMedicine(med.medicineId);
            if (!medicine) {
              return res.status(400).json({ error: `Medicine with ID ${med.medicineId} not found` });
            }
            if (medicine.quantity < med.quantity) {
              return res.status(400).json({ 
                error: `Insufficient stock for ${med.medicineName}. Available: ${medicine.quantity}, Required: ${med.quantity}` 
              });
            }
            await storage.updateMedicineStock(med.medicineId, -med.quantity);
          }
        }
      }
      
      const bill = await storage.createBill(validated, patient.name);
      res.status(201).json(bill);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error("Error creating bill:", error);
      res.status(500).json({ error: "Failed to create bill", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.patch("/api/bills/:id", async (req, res) => {
    try {
      const validated = insertBillSchema.parse(req.body);
      
      // Get patient name
      const patient = await storage.getPatient(validated.patientId);
      if (!patient) {
        return res.status(400).json({ error: "Patient not found" });
      }
      
      // Get existing bill to restore medicine stock
      const existingBill = await storage.getBill(req.params.id);
      if (existingBill) {
        // Restore medicine stock from old bill
        for (const med of existingBill.medicines) {
          await storage.updateMedicineStock(med.medicineId, med.quantity);
        }
      }
      
      // Reduce medicine stock for new bill
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

  app.patch("/api/bills/:id/payment", async (req, res) => {
    try {
      const { addAmount } = req.body;
      if (typeof addAmount !== "number" || addAmount < 0) {
        return res.status(400).json({ error: "Invalid payment amount" });
      }
      
      // Get current bill to calculate new total
      const currentBill = await storage.getBill(req.params.id);
      if (!currentBill) {
        return res.status(404).json({ error: "Bill not found" });
      }

      // Calculate new total paid and validate
      const newTotalPaid = currentBill.amountPaid + addAmount;
      if (newTotalPaid > currentBill.grandTotal) {
        return res.status(400).json({ 
          error: `Cannot exceed bill amount. Remaining: ₹${(currentBill.grandTotal - currentBill.amountPaid).toFixed(2)}` 
        });
      }
      
      const bill = await storage.updateBillPayment(req.params.id, newTotalPaid);
      if (!bill) {
        return res.status(404).json({ error: "Bill not found" });
      }
      res.json(bill);
    } catch (error) {
      res.status(500).json({ error: "Failed to update payment" });
    }
  });

  app.delete("/api/bills/:id", async (req, res) => {
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

  // ==================== EXPENSES ====================
  
  app.get("/api/expenses", async (req, res) => {
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

  app.get("/api/expenses/:id", async (req, res) => {
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

  app.post("/api/expenses", async (req, res) => {
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

  app.patch("/api/expenses/:id", async (req, res) => {
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

  app.delete("/api/expenses/:id", async (req, res) => {
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

  return httpServer;
}
