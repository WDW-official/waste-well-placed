import { config } from "dotenv";
config({ path: ".env.local" });
config();
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Booking, Hold, Slot, Catalog } from "../src/lib/models";
import {
  Tariff,
  BookingChange,
  RefundRequest,
  CompanyProfile,
  Invoice,
  Counter,
  Review,
} from "../src/lib/workflow-models";
import { initialisePriceBook } from "../src/lib/catalog";
import { releaseExpiredHolds } from "../src/lib/slot-holds";
async function main() {
  mongoose.set("autoIndex", false);
  mongoose.set("autoCreate", false);
  await connectDB();
  const apply = process.argv.includes("--apply");
  const indexes = await Hold.collection.indexes().catch(() => []);
  const obsolete = indexes.filter(
    (index) => index.key?.expiresAt && index.expireAfterSeconds !== undefined,
  );
  console.log(
    JSON.stringify(
      {
        mode: apply ? "APPLY" : "READ ONLY",
        obsoleteHoldTtlIndexes: obsolete.map((index) => index.name),
        futureReservedSlots: await Slot.countDocuments({
          start: { $gt: new Date() },
          reservedCount: { $gt: 0 },
        }),
        unpaidBookings: await Booking.countDocuments({
          status: "pending_payment",
          paymentStatus: "pending",
        }),
      },
      null,
      2,
    ),
  );
  if (!apply) {
    console.log(
      "No changes made. Back up the database and review the audit-fix rollout before using --apply.",
    );
    return;
  }
  for (const index of obsolete) await Hold.collection.dropIndex(index.name!);
  for (const model of [
    Hold,
    Catalog,
    Tariff,
    BookingChange,
    RefundRequest,
    CompanyProfile,
    Invoice,
    Counter,
    Review,
  ]) {
    await model.createCollection();
    await model.createIndexes();
  }
  await initialisePriceBook();
  await releaseExpiredHolds();
  console.log(
    "Audit migration complete. Existing prices were preserved; no account roles, driver approvals, payments, refunds or emails were changed or sent.",
  );
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Audit migration failed",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
