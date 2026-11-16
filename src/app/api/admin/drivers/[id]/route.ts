import { z } from "zod";
import { connectDB } from "@/lib/db";
import { DriverApplication, OperationsPolicy } from "@/lib/operations/models";
import {
  requireUser,
  requireCondition,
  decryptIdentity,
} from "@/lib/operations/security";
import { checksSchema, objectId } from "@/lib/operations/validation";
import { eligibilityProblems } from "@/lib/operations/policy";
import { audit, notify } from "@/lib/operations/events";
import { User } from "@/lib/models";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser("drivers");
    await connectDB();
    const application = await DriverApplication.findById(
      objectId.parse((await params).id),
    ).lean();
    requireCondition(application, "Application not found", 404);
    const account = await User.findById(application.userId)
      .select("email name")
      .lean();
    let drivingCheck:
      { licenceLastEight: string; dvlaCheckCode: string } | undefined;
    if (new URL(req.url).searchParams.get("identity") === "1") {
      const reviewer = await requireUser("drivers");
      const protectedData = await DriverApplication.findById(
        application._id,
      ).select("+licenceLastEight +dvlaCheckCode");
      if (protectedData?.licenceLastEight && protectedData.dvlaCheckCode)
        drivingCheck = {
          licenceLastEight: decryptIdentity(protectedData.licenceLastEight),
          dvlaCheckCode: decryptIdentity(protectedData.dvlaCheckCode),
        };
      await audit(
        reviewer.id,
        "driver.driving_check_accessed",
        String(application._id),
      );
    }
    return ok({ application, account, drivingCheck });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("drivers");
    const id = objectId.parse((await params).id);
    const data = z
      .object({
        status: z.enum([
          "driving_review",
          "vehicle_review",
          "compliance_review",
          "more_information",
          "rejected",
          "active",
          "suspended",
        ]),
        version: z.number().int().nonnegative(),
        note: z.string().min(5).max(2000),
        checks: checksSchema,
      })
      .parse(await req.json());
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const driver = await DriverApplication.findOne({
        _id: id,
        version: data.version,
      }).session(session);
      requireCondition(
        driver && driver.status !== "draft",
        "Application changed or has not been submitted",
        409,
      );
      requireCondition(
        String(driver.userId) !== user.id,
        "You cannot review your own driver profile",
        403,
      );
      const policy = await OperationsPolicy.findOne({
        key: "operations",
      }).session(session);
      if (data.status === "active") {
        requireCondition(
          policy?.approved,
          "Owner must approve the operational eligibility policy first",
        );
        const problems = eligibilityProblems(
          { ...driver.toObject(), checks: data.checks },
          new Date(),
          policy.minAge,
          policy.maxPoints,
        );
        requireCondition(!problems.length, problems.join("; "));
        requireCondition(
          driver.documents.length >= 8,
          "Required documents are missing",
        );
        requireCondition(
          driver.documents.every(
            (document) =>
              !document.expiresAt || document.expiresAt.getTime() > Date.now(),
          ),
          "An uploaded document has expired",
        );
      }
      const changed = await DriverApplication.updateOne(
        { _id: id, version: data.version },
        {
          $set: {
            status: data.status,
            checks: data.checks,
            reviewedBy: user.id,
            reviewedAt: new Date(),
            reviewNotes: data.note,
            online: false,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      requireCondition(
        changed.modifiedCount,
        "Application changed. Refresh.",
        409,
      );
      await audit(
        user.id,
        `driver.${data.status}`,
        id,
        { note: data.note, checks: data.checks },
        session,
      );
      const account = await User.findById(driver.userId)
        .session(session)
        .lean();
      await notify(
        {
          key: `driver:${id}:${data.version}`,
          event: "driver_review",
          reference: id,
          recipientId: String(driver.userId),
          email: account?.email,
          subject: "Your driver application has an update",
          message: `Application status: ${data.status.replaceAll("_", " ")}. ${data.note}`,
          href: "/driver",
        },
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
