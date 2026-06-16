// Helper to load environment variables from .env file manually
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const matches = envContent.matchAll(/export\s+([^=]+)="?([^"\n]+)"?/g);
    for (const match of matches) {
      const [, key, val] = match;
      process.env[key.trim()] = val.trim();
    }
  }
}

// Load env variables first!
loadEnv();

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not defined in environment or .env file!");
    process.exit(1);
  }

  // Now dynamically import storage and schema after environment is set
  const { storage } = await import("../server/storage");
  const { insertMedicineSchema } = await import("../shared/schema");

  console.log("Initializing database storage and running migrations...");
  // This will trigger ensureTables() in storage.ts
  const medicinesBefore = await storage.getMedicines();
  console.log(`Successfully fetched existing medicines. Count: ${medicinesBefore.length}`);

  const testMedicineData = {
    name: `Test Medicine ${Date.now()}`,
    purchaseCost: 10.5,
    sellingPrice: 15.0,
    quantity: 100,
    type: "Medicine" as const,
    vendorName: "Acme Pharma Ltd",
  };

  console.log("\nValidating schema with insertMedicineSchema.parse...");
  const validated = insertMedicineSchema.parse(testMedicineData);
  console.log("Validation successful!");

  console.log("\nCreating new medicine with vendor name...");
  const created = await storage.createMedicine(validated);
  console.log("Created Medicine:", created);

  if (created.vendorName !== "Acme Pharma Ltd") {
    console.error(`Expected vendorName 'Acme Pharma Ltd', got '${created.vendorName}'`);
    process.exit(1);
  }
  console.log("Verification of create medicine: SUCCESS");

  console.log("\nFetching created medicine from DB...");
  const fetched = await storage.getMedicine(created.id);
  console.log("Fetched Medicine:", fetched);

  if (!fetched || fetched.vendorName !== "Acme Pharma Ltd") {
    console.error(`Fetched medicine vendorName verification failed. Got:`, fetched);
    process.exit(1);
  }
  console.log("Verification of get medicine: SUCCESS");

  console.log("\nUpdating medicine vendor name...");
  const updateData = {
    ...validated,
    vendorName: "Globex Corporation",
  };
  const updated = await storage.updateMedicine(created.id, updateData);
  console.log("Updated Medicine:", updated);

  if (!updated || updated.vendorName !== "Globex Corporation") {
    console.error(`Updated medicine vendorName verification failed. Got:`, updated);
    process.exit(1);
  }
  console.log("Verification of update medicine: SUCCESS");

  console.log("\nDeleting test medicine...");
  const deleted = await storage.deleteMedicine(created.id);
  console.log(`Deleted: ${deleted}`);

  if (!deleted) {
    console.error("Failed to delete medicine");
    process.exit(1);
  }
  console.log("Verification of delete medicine: SUCCESS");

  console.log("\nAll Database and Storage verification checks passed successfully!");
  process.exit(0);
}

run().catch((err) => {
  console.error("Verification failed with error:", err);
  process.exit(1);
});
