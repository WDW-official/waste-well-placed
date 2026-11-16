import { config } from "dotenv";
config({ path: ".env.local" });
config();
import mongoose from "mongoose";
import { connectDB } from "../src/lib/db";
import { Booking, Quote, User } from "../src/lib/models";
import {
  DriverApplication,
  Issue,
  OperationsPolicy,
} from "../src/lib/operations/models";
async function main() {
  await connectDB();
  const apply = process.argv.includes("--apply");
  const report = {
    mode: apply ? "APPLY" : "READ ONLY",
    bookingsWithoutVersion: await Booking.countDocuments({
      version: { $exists: false },
    }),
    quotesWithoutVersion: await Quote.countDocuments({
      version: { $exists: false },
    }),
    legacyCrewAccounts: await User.countDocuments({ role: "crew" }),
    legacyCompletions: await Booking.countDocuments({ status: "completed" }),
    legacyPublicPhotoBookings: await Booking.countDocuments({
      "photos.secureUrl": /^https:\/\/res\.cloudinary\.com\//,
    }),
    legacyPublicPhotoQuotes: await Quote.countDocuments({
      "photos.secureUrl": /^https:\/\/res\.cloudinary\.com\//,
    }),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) {
    console.log(
      "No changes made. Back up the database and use --apply after reviewing docs/PLATFORM-V1.2-DEPLOYMENT.md.",
    );
    return;
  }
  // Additive/backfillable changes only. Do not infer compliance or approve a driver.
  await Booking.updateMany({ quoteId: null }, { $unset: { quoteId: "" } });
  await Booking.updateMany(
    { version: { $exists: false } },
    { $set: { version: 0, pricingVersion: 1 } },
  );
  await Booking.updateMany(
    { refundsMinor: { $exists: false } },
    { $set: { refundsMinor: 0, chargebackMinor: 0 } },
  );
  await Quote.updateMany(
    { version: { $exists: false } },
    { $set: { version: 0 } },
  );
  const legacyCrew = await User.find({ role: "crew" }).select("name phone");
  for (const user of legacyCrew) {
    await DriverApplication.updateOne(
      { userId: user._id },
      {
        $setOnInsert: {
          userId: user._id,
          legalName: user.name,
          phone: user.phone,
          status: "draft",
          reviewNotes:
            "Legacy crew account. Full application and human checks are required before activation.",
        },
      },
      { upsert: true },
    );
    await User.updateOne(
      { _id: user._id, role: "crew" },
      { $set: { role: "driver" } },
    );
  }
  const legacyJobs = await Booking.find({ status: "completed" }).select("_id");
  for (const job of legacyJobs)
    await Issue.updateOne(
      { bookingId: job._id, kind: "legacy_evidence_review" },
      {
        $setOnInsert: {
          bookingId: job._id,
          kind: "legacy_evidence_review",
          note: "Historical completion was not independently verified. Review original facility records before issuing documents or settlements.",
          status: "open",
        },
      },
      { upsert: true },
    );
  await OperationsPolicy.updateOne(
    { key: "operations" },
    {
      $setOnInsert: {
        key: "operations",
        approved: false,
        minAge: 21,
        maxPoints: 6,
        minimumMarginMinor: 0,
        version: 1,
      },
    },
    { upsert: true },
  );
  // Create every collection before transactions and build indexes without dropping existing indexes.
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
  console.log(
    "Additive migration complete. Historical public uploads are reported but not reclassified or deleted. No policy, driver, facility or payout was approved.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Migration failed");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
