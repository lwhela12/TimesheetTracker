import { db } from "./db";
import { settings } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function seedDatabase() {
  console.log("Seeding database with default settings...");

  // Default settings
  const defaultSettings = [
    { company_id: 1, key: "mileage_rate", value: "0.67" }, // Current IRS rate
    { company_id: 1, key: "ot_threshold", value: "8" }, // Daily overtime threshold
    { company_id: 1, key: "work_week_start", value: "3" }, // Wednesday = 3
    { company_id: 1, key: "holiday_rate_multiplier", value: "1.5" }
  ];

  for (const setting of defaultSettings) {
    // Check if setting already exists
    const [existing] = await db
      .select()
      .from(settings)
      .where(and(eq(settings.key, setting.key), eq(settings.company_id, setting.company_id)));

    if (!existing) {
      await db.insert(settings).values(setting);
      console.log(`Created setting: ${setting.key} = ${setting.value}`);
    } else {
      console.log(`Setting already exists: ${setting.key} = ${existing.value}`);
    }
  }

  console.log("Database seeding completed!");
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("Seeding failed:", error);
      process.exit(1);
    });
}

export { seedDatabase };