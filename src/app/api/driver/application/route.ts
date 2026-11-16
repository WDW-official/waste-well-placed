import { z } from "zod";
import { connectDB } from "@/lib/db";
import { DriverApplication } from "@/lib/operations/models";
import {
  requireUser,
  requireCondition,
  encryptIdentity,
} from "@/lib/operations/security";
import { applicationSchema } from "@/lib/operations/validation";
import { ownAssets } from "@/lib/operations/assets";
import { audit, notifyStaff } from "@/lib/operations/events";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const user = await requireUser();
    requireCondition(user.role === "driver", "Driver account required", 403);
    await connectDB();
    const application = await DriverApplication.findOne({
      userId: user.id,
    }).lean();
    return ok({ application });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser();
    requireCondition(user.role === "driver", "Driver account required", 403);
    const body = z
      .object({
        action: z.enum(["draft", "submit"]),
        version: z.number().int().nonnegative(),
        data: z.record(z.unknown()),
      })
      .parse(await req.json());
    requireCondition(
      JSON.stringify(body.data).length < 50_000,
      "Application is too large",
    );
    const allowedKeys = Object.keys(applicationSchema.innerType().shape);
    const draft = Object.fromEntries(
      Object.entries(body.data).filter(
        ([key]) =>
          allowedKeys.includes(key) &&
          !["licenceLastEight", "dvlaCheckCode"].includes(key),
      ),
    );
    const data =
      body.action === "submit" ? applicationSchema.parse(body.data) : undefined;
    if (data)
      await ownAssets(
        data.documents.map((document) => document.assetId),
        user.id,
        "driver_document",
      );
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const changed = await DriverApplication.findOneAndUpdate(
        {
          userId: user.id,
          version: body.version,
          status: { $in: ["draft", "more_information"] },
        },
        {
          $set: {
            draft,
            ...(data
              ? {
                  ...data,
                  licenceLastEight: encryptIdentity(data.licenceLastEight),
                  dvlaCheckCode: encryptIdentity(data.dvlaCheckCode),
                  status: "submitted",
                  submittedAt: new Date(),
                  checks: {
                    identity: false,
                    licence: false,
                    insurance: false,
                    carrier: false,
                    vehicle: false,
                    contract: false,
                  },
                }
              : {}),
          },
          $inc: { version: 1 },
        },
        { session, new: true },
      );
      requireCondition(
        changed,
        "Application changed or is already under review",
        409,
      );
      if (data) {
        await audit(
          user.id,
          "driver.application_submitted",
          String(changed._id),
          {},
          session,
        );
        await notifyStaff(
          `application:${changed._id}:${changed.version}`,
          "driver_application",
          String(changed._id),
          "A driver application needs human review.",
          `/admin/drivers/${changed._id}`,
          session,
        );
      }
    });
    return ok({ saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
