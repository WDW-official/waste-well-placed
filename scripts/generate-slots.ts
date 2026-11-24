import { config } from "dotenv";
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Slot } from "../src/lib/models";
import { collectionSlots } from "../src/lib/collection-slots";

config({ path: ".env.local" });
config();

async function main() {
  await connectDB();
  let created = 0;
  let existing = 0;
  const slots = collectionSlots();
  for (const slot of slots) {
    // Preserve any existing window, including deactivated or reserved slots.
    if (
      await Slot.exists({ start: { $lt: slot.end }, end: { $gt: slot.start } })
    ) {
      existing++;
      continue;
    }
    const result = await Slot.updateOne(
      { zoneId: null, start: slot.start },
      { $setOnInsert: { ...slot, reservedCount: 0, active: true } },
      { upsert: true },
    );
    created += result.upsertedCount;
  }
  console.log(
    JSON.stringify({
      created,
      preserved: existing,
      first: slots[0]?.start,
      last: slots.at(-1)?.end,
      capacityPerWindow: 3,
      timezone: "Europe/London",
    }),
  );
}

main()
  .catch((error) => {
    console.error(
      "Slot generation failed:",
      error instanceof Error ? error.name : "Unknown error",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
