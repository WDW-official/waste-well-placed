import { z } from "zod";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { pence } from "@/lib/operations/validation";
import { OperationsPolicy } from "@/lib/operations/models";
import { connectDB } from "@/lib/db";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("policy");
    const data = z
      .object({
        minAge: z.number().int().min(18).max(70),
        maxPoints: z.number().int().min(0).max(6),
        minimumMarginMinor: pence,
        driverPayMode: z.enum(["fixed", "percentage"]),
        driverRateBps: z.number().int().min(0).max(10000),
        note: z.string().min(10).max(1000),
      })
      .parse(await req.json());
    requireCondition(
      data.driverPayMode !== "percentage" || data.driverRateBps > 0,
      "Set a positive rate for percentage pay",
    );
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const policy = await OperationsPolicy.findOneAndUpdate(
        { key: "operations" },
        {
          $set: {
            ...data,
            approved: true,
            approvedBy: user.id,
            approvedAt: new Date(),
          },
          $inc: { version: 1 },
        },
        { upsert: true, session, new: true },
      );
      await audit(
        user.id,
        "policy.approved",
        String(policy._id),
        { ...data, version: policy.version },
        session,
      );
    });
    return ok({ saved: true });
  } catch (error) {
    return errorResponse(error);
  }
}
