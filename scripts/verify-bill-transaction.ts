
import { storage } from '../server/storage';

async function main() {
    console.log("Starting verification...");

    // 1. Setup Data
    const timestamp = Date.now();
    console.log("Creating test patient...");
    const patient = await storage.createPatient({
        name: `Test Patient ${timestamp}`,
        age: 30,
        gender: "Male",
        mobile: `1234567890`,
        email: `test${timestamp}@example.com`,
        address: "Test Address",
        medicalHistory: "None"
    });
    console.log("Created patient:", patient.id);

    console.log("Creating test medicine...");
    const medicine = await storage.createMedicine({
        name: `Test Med ${timestamp}`,
        quantity: 10,
        purchaseCost: 50,
        sellingPrice: 100,
        expiryDate: "2025-12-31",
        manufacturer: "Test Pharma",
        description: "Test Description"
    } as any);
    // Note: Cast to any or partial because createMedicine signature in storage.ts might vary slightly from schema 
    // based on provided code helper methods, but let's assume it matches InsertMedicine.

    console.log("Created medicine:", medicine.id, "Qty:", medicine.quantity);

    // 2. Test Successful Bill with Stock Deduction
    console.log("\nTest 1: Create Bill with valid stock (Qty: 2)");
    const billData = {
        patientId: patient.id,
        date: new Date().toISOString(),
        treatments: [],
        medicines: [
            { medicineId: medicine.id, medicineName: medicine.name, quantity: 2, unitPrice: 100, total: 200 }
        ],
        treatmentTotal: 0,
        medicineTotal: 200,
        grandTotal: 200,
        discount: 0,
        finalAmount: 200,
        amountPaid: 200
    };

    try {
        const bill = await storage.createBillWithStockUpdate(billData as any, patient.name);
        console.log("Bill created successfully:", bill.id);
    } catch (e) {
        console.error("Failed to create bill:", e);
        process.exit(1);
    }

    // Verify stock
    const updatedMedicine = await storage.getMedicine(medicine.id);
    console.log("Updated Stock:", updatedMedicine?.quantity);
    if (updatedMedicine?.quantity !== 8) {
        console.error("Stock mismatch! Expected 8, got", updatedMedicine?.quantity);
        process.exit(1);
    } else {
        console.log("Stock deducted correctly.");
    }

    // 3. Test Insufficient Stock
    console.log("\nTest 2: Create Bill with insufficient stock (Qty: 100)");
    const badBillData = {
        ...billData,
        medicines: [
            { medicineId: medicine.id, medicineName: medicine.name, quantity: 100, unitPrice: 100, total: 10000 }
        ],
        medicineTotal: 10000,
        grandTotal: 10000,
        finalAmount: 10000,
        amountPaid: 10000
    };

    try {
        await storage.createBillWithStockUpdate(badBillData as any, patient.name);
        console.error("Error: Bill creation should have failed!");
        process.exit(1);
    } catch (e: any) {
        console.log("Bill creation failed as expected with error:", e.message);
        if (!e.message.includes("Insufficient stock")) {
            console.error("Unexpected error message.");
            process.exit(1);
        }
    }

    // Verify stock remained same
    const finalMedicine = await storage.getMedicine(medicine.id);
    console.log("Final Stock:", finalMedicine?.quantity);
    if (finalMedicine?.quantity !== 8) {
        console.error("Stock changed after failed failure! Expected 8, got", finalMedicine?.quantity);
        process.exit(1);
    } else {
        console.log("Stock remained unchanged.");
    }

    console.log("\nVerification Successful!");
    process.exit(0);
}

main().catch(console.error);
