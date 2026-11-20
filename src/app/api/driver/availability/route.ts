import { z } from "zod";
import { connectDB } from "@/lib/db";
import {
  DriverApplication,
  OperationsPolicy,
  Assignment,
} from "@/lib/operations/models";
import { driverEligible } from "@/lib/operations/policy";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function PATCH(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser();
    requireCondition(user.role === "driver", "Driver account required", 403);
    requireCondition(
      !user.driverPasswordPending,
      "Set your password using the approval email before accessing driver work.",
      403,
    );
    const data = z
      .object({ online: z.boolean(), until: z.string().datetime().optional() })
      .parse(await req.json());
    await connectDB();
    const driver = await DriverApplication.findOne({ userId: user.id });
    const policy = await OperationsPolicy.findOne({ key: "operations" });
    requireCondition(driver, "Application not found", 404);
    if (data.online) {
      requireCondition(
        policy?.approved &&
          driverEligible(
            driver.toObject(),
            new Date(),
            policy.minAge,
            policy.maxPoints,
          ),
        "Your profile needs review before going online",
        403,
      );
      requireCondition(
        data.until &&
          new Date(data.until).getTime() > Date.now() &&
          new Date(data.until).getTime() < Date.now() + 24 * 3600_000,
        "Choose an availability end within the next 24 hours",
      );
      requireCondition(
        !(await Assignment.exists({ driverId: user.id, live: true })),
        "You already have an active job or offer",
        409,
      );
    }
    await DriverApplication.updateOne(
      { _id: driver._id },
      {
        $set: {
          online: data.online,
          availableUntilAt: data.online ? new Date(data.until!) : null,
        },
      },
    );
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
