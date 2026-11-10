import { connectDB } from "@/lib/db";
import { Slot } from "@/lib/models";
import { findZone } from "@/lib/coverage";
import { postcode } from "@/lib/validation";
import { ok, fail, errorResponse } from "@/lib/http";
import { releaseExpiredHolds } from "@/lib/slot-holds";
export async function GET(req: Request) {
  try {
    const p = new URL(req.url).searchParams;
    const code = postcode.parse(p.get("postcode") || "");
    const date = p.get("date") || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Choose a valid date");
    const day = new Date(`${date}T00:00:00Z`);
    if (
      !Number.isFinite(day.getTime()) ||
      day.getTime() < Date.now() - 86400000
    )
      return fail("Choose a future date");
    const zone = await findZone(code);
    if (!zone) return ok({ slots: [], error: "Area not served" });
    await connectDB();
    await releaseExpiredHolds();
    const end = new Date(day.getTime() + 86400000);
    const found = await Slot.find({
      zoneId: zone._id,
      start: { $gte: day, $lt: end, $gt: new Date() },
      active: true,
      $expr: { $lt: ["$reservedCount", "$capacity"] },
    })
      .sort({ start: 1 })
      .lean();
    return ok({
      slots: found.map((s) => ({
        id: String(s._id),
        start: s.start,
        end: s.end,
        remaining: s.capacity - s.reservedCount,
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
