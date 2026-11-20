import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Hold, Slot } from "@/lib/models";
import { releaseExpiredHolds } from "@/lib/slot-holds";
import { ok, errorResponse, fail, ensureSameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const session = await getSession();
    if (!session) return fail("Log in to reserve a collection slot", 401);
    const { slotId } = z
      .object({ slotId: z.string().regex(/^[a-f0-9]{24}$/i) })
      .parse(await req.json());
    await connectDB();
    await releaseExpiredHolds();
    const db = await connectDB();
    const result = await db.connection.transaction(async (transaction) => {
      const slot = await Slot.findOneAndUpdate(
        {
          _id: slotId,
          active: true,
          start: { $gt: new Date() },
          $expr: { $lt: ["$reservedCount", "$capacity"] },
        },
        { $inc: { reservedCount: 1 } },
        { new: true, session: transaction },
      );
      if (!slot) return null;
      const [hold] = await Hold.create(
        [
          {
            slotId,
            userId: session.id,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
            status: "active",
          },
        ],
        { session: transaction },
      );
      return { holdId: String(hold._id), expiresAt: hold.expiresAt };
    });
    return result
      ? ok(result, 201)
      : fail("This appointment is no longer available", 409);
  } catch (e) {
    return errorResponse(e);
  }
}
