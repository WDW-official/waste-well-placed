import { Hold, Slot } from "@/lib/models";
// Before returning availability, release expired holds while preserving consumed holds.
export async function releaseExpiredHolds() {
  const expired = await Hold.find({
    status: "active",
    expiresAt: { $lte: new Date() },
  })
    .select("_id slotId")
    .limit(150);
  for (const h of expired) {
    const changed = await Hold.updateOne(
      { _id: h._id, status: "active" },
      { $set: { status: "expired" } },
    );
    if (changed.modifiedCount)
      await Slot.updateOne(
        { _id: h.slotId, reservedCount: { $gt: 0 } },
        { $inc: { reservedCount: -1 } },
      );
  }
}
