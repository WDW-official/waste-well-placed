import { config } from "dotenv";
config({ path: ".env.local" });
config();
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/lib/models";
import {
  DriverApplication,
  OperationsPolicy,
  Facility,
} from "../src/lib/operations/models";
async function main() {
  const uri = process.env.MONGODB_TEST_URI;
  if (!uri || !/_test(?:\?|$)/.test(uri))
    throw Error(
      "Use an isolated MONGODB_TEST_URI whose database name ends in _test",
    );
  const password = process.env.PLATFORM_TEST_PASSWORD;
  if (!password || password.length < 12)
    throw Error("Set PLATFORM_TEST_PASSWORD (at least 12 characters)");
  await mongoose.connect(uri);
  const passwordHash = await bcrypt.hash(password, 12);
  for (const [email, role, name] of [
    ["owner@example.test", "superadmin", "Test owner"],
    ["dispatcher@example.test", "dispatcher", "Test dispatcher"],
    ["finance@example.test", "finance", "Test finance"],
    ["compliance@example.test", "compliance", "Test verifier"],
    ["driver@example.test", "driver", "Test applicant"],
    ["customer@example.test", "customer", "Test customer"],
  ]) {
    const user = await User.findOneAndUpdate(
      { email },
      { $setOnInsert: { name, email, role, passwordHash } },
      { upsert: true, new: true },
    );
    if (role === "driver")
      await DriverApplication.updateOne(
        { userId: user._id },
        {
          $setOnInsert: { userId: user._id, legalName: name, status: "draft" },
        },
        { upsert: true },
      );
  }
  await OperationsPolicy.updateOne(
    { key: "operations" },
    { $setOnInsert: { key: "operations", approved: false } },
    { upsert: true },
  );
  await Facility.updateOne(
    { name: "Demo facility — NOT APPROVED" },
    {
      $setOnInsert: {
        name: "Demo facility — NOT APPROVED",
        permitReference: "TEST-ONLY",
        active: false,
        wasteTypes: ["mixed"],
      },
    },
    { upsert: true },
  );
  for (const model of Object.values(mongoose.models)) {
    await model.createCollection();
    await model.createIndexes();
  }
  console.log(
    "Isolated test accounts created. The sample applicant, policy and facility remain unapproved. Passwords are not printed.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Test seed failed");
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
