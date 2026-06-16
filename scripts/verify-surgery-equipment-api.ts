import { randomUUID } from "crypto";

const BASE_URL = "http://localhost:5050";

async function runTest() {
    console.log("Starting API-based integration verification...");

    // 1. Authenticate (Login)
    console.log("\nLogging in...");
    const loginRes = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Admin", password: "Dr.Admin" })
    });

    if (!loginRes.ok) {
        console.error("Login failed:", await loginRes.text());
        process.exit(1);
    }

    const cookie = loginRes.headers.get("set-cookie");
    if (!cookie) {
        console.error("No session cookie returned!");
        process.exit(1);
    }
    console.log("Login successful! Cookie received.");

    const headers = {
        "Content-Type": "application/json",
        "Cookie": cookie
    };

    const timestamp = Date.now();

    // 2. Create Patient
    console.log("\nCreating patient...");
    const patientRes = await fetch(`${BASE_URL}/api/patients`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            name: `Test Patient ${timestamp}`,
            phone: "9876543210",
            registrationDate: new Date().toISOString().split('T')[0],
            dob: "1990-01-01",
            status: "Active",
            source: "Walk-in"
        })
    });

    if (!patientRes.ok) {
        console.error("Create Patient failed:", await patientRes.text());
        process.exit(1);
    }
    const patient = await patientRes.json();
    console.log(`Created Patient: ${patient.name} (${patient.id})`);

    // 3. Create Surgery Equipment (Medicine with type = 'Equipment')
    console.log("\nCreating Surgery Equipment...");
    const equipmentRes = await fetch(`${BASE_URL}/api/medicines`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            name: `Laser Fiber ${timestamp}`,
            purchaseCost: 150,
            sellingPrice: 300,
            quantity: 10,
            type: "Equipment"
        })
    });

    if (!equipmentRes.ok) {
        console.error("Create Equipment failed:", await equipmentRes.text());
        process.exit(1);
    }
    const equipment = await equipmentRes.json();
    console.log(`Created Equipment: ${equipment.name} (${equipment.id}) with type ${equipment.type}, Qty: ${equipment.quantity}`);

    if (equipment.type !== "Equipment") {
        console.error(`Expected type 'Equipment', got ${equipment.type}`);
        process.exit(1);
    }

    // 4. Create Surgery Treatment with the associated Equipment (quantity = 3)
    console.log("\nCreating Surgery Treatment...");
    const treatmentRes = await fetch(`${BASE_URL}/api/treatments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            name: `Laser Surgery ${timestamp}`,
            defaultPrice: 8000,
            type: "Surgery",
            equipments: [
                { medicineId: equipment.id, quantity: 3 }
            ]
        })
    });

    if (!treatmentRes.ok) {
        console.error("Create Treatment failed:", await treatmentRes.text());
        process.exit(1);
    }
    const treatment = await treatmentRes.json();
    console.log(`Created Treatment: ${treatment.name} (${treatment.id}) with type ${treatment.type}, Equipments:`, treatment.equipments);

    if (treatment.type !== "Surgery") {
        console.error(`Expected treatment type 'Surgery', got ${treatment.type}`);
        process.exit(1);
    }
    if (!treatment.equipments || treatment.equipments.length === 0 || treatment.equipments[0].medicineId !== equipment.id) {
        console.error("Associated equipments are incorrect on treatment creation");
        process.exit(1);
    }

    // Helper function to get equipment stock
    const getEquipmentStock = async () => {
        const res = await fetch(`${BASE_URL}/api/medicines/${equipment.id}`, { headers });
        if (!res.ok) throw new Error("Failed to get medicine details");
        const med = await res.json();
        return med.quantity;
    };

    // 5. Create Bill with the Surgery Treatment
    console.log("\nCreating Bill with Surgery Treatment...");
    const billData = {
        patientId: patient.id,
        date: new Date().toISOString().split('T')[0],
        treatments: [
            { treatmentId: treatment.id, treatmentName: treatment.name, price: 8000 }
        ],
        medicines: [],
        treatmentTotal: 8000,
        medicineTotal: 0,
        grandTotal: 8000,
        discount: 0,
        finalAmount: 8000,
        amountPaid: 8000
    };

    const billRes = await fetch(`${BASE_URL}/api/bills`, {
        method: "POST",
        headers,
        body: JSON.stringify(billData)
    });

    if (!billRes.ok) {
        console.error("Create Bill failed:", await billRes.text());
        process.exit(1);
    }
    const bill = await billRes.json();
    console.log(`Created Bill: ${bill.id}`);

    // Verify stock is deducted (10 - 3 = 7)
    let stock = await getEquipmentStock();
    console.log(`Stock after bill creation: ${stock} (Expected: 7)`);
    if (stock !== 7) {
        console.error(`Stock verification failed: expected 7, got ${stock}`);
        process.exit(1);
    }

    // Verify snapshot was stored inside the bill
    if (!bill.treatments[0].equipments || bill.treatments[0].equipments[0].medicineId !== equipment.id) {
        console.error("Bill treatment items missing equipment snapshot:", bill.treatments[0]);
        process.exit(1);
    }
    console.log("Equipment snapshot stored inside the bill treatments successfully.");

    // 6. Update Bill (e.g. increase treatment price or edit treatments to General Treatment, which should RESTORE stock)
    console.log("\nUpdating Bill - switching treatment to a different one to restore stock...");
    // Let's create a General treatment first
    const genTreatmentRes = await fetch(`${BASE_URL}/api/treatments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
            name: `General Consultation ${timestamp}`,
            defaultPrice: 1000,
            type: "General",
            equipments: []
        })
    });
    const genTreatment = await genTreatmentRes.json();

    const updatedBillData = {
        ...billData,
        treatments: [
            { treatmentId: genTreatment.id, treatmentName: genTreatment.name, price: 1000 }
        ],
        treatmentTotal: 1000,
        grandTotal: 1000,
        finalAmount: 1000,
        amountPaid: 1000
    };

    const updateRes = await fetch(`${BASE_URL}/api/bills/${bill.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updatedBillData)
    });

    if (!updateRes.ok) {
        console.error("Update Bill failed:", await updateRes.text());
        process.exit(1);
    }
    console.log("Bill updated successfully.");

    // Verify stock is restored (7 + 3 = 10)
    stock = await getEquipmentStock();
    console.log(`Stock after bill update: ${stock} (Expected: 10)`);
    if (stock !== 10) {
        console.error(`Stock restoration verification failed: expected 10, got ${stock}`);
        process.exit(1);
    }

    // 7. Update Bill back to Surgery Treatment (should deduct stock again)
    console.log("\nUpdating Bill back to Surgery Treatment...");
    const updateRes2 = await fetch(`${BASE_URL}/api/bills/${bill.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(billData)
    });

    if (!updateRes2.ok) {
        console.error("Update Bill back failed:", await updateRes2.text());
        process.exit(1);
    }
    console.log("Bill updated back to Surgery Treatment successfully.");

    // Verify stock is deducted again (10 - 3 = 7)
    stock = await getEquipmentStock();
    console.log(`Stock after update back: ${stock} (Expected: 7)`);
    if (stock !== 7) {
        console.error(`Stock verification failed after update back: expected 7, got ${stock}`);
        process.exit(1);
    }

    // 8. Delete Bill (should restore stock)
    console.log("\nDeleting Bill...");
    const deleteRes = await fetch(`${BASE_URL}/api/bills/${bill.id}`, {
        method: "DELETE",
        headers
    });

    if (!deleteRes.ok) {
        console.error("Delete Bill failed:", await deleteRes.text());
        process.exit(1);
    }
    console.log("Bill deleted successfully.");

    // Verify stock is restored to 10
    stock = await getEquipmentStock();
    console.log(`Stock after bill deletion: ${stock} (Expected: 10)`);
    if (stock !== 10) {
        console.error(`Stock restoration verification failed: expected 10, got ${stock}`);
        process.exit(1);
    }

    console.log("\nAll API/Database validations passed successfully!");
    process.exit(0);
}

runTest().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
