import type { ClientSession } from "mongoose";
import { connectDB } from "./db";
import { Booking, Hold, Slot } from "./models";

export async function releaseBookingSlot(
  bookingId: string,
  status: "expired" | "cancelled",
  session: ClientSession,
) {
  const changed = await Booking.findOneAndUpdate(
    { _id: bookingId, slotReleasedAt: { $exists: false } },
    {
      $set: {
        status,
        slotReleasedAt: new Date(),
        ...(status === "cancelled" ? { cancelledAt: new Date() } : {}),
      },
      $inc: { version: 1 },
      $push: {
        events: {
          status,
          at: new Date(),
          note:
            status === "expired"
              ? "Payment window expired"
              : "Cancellation approved by staff",
        },
      },
    },
    { new: true, session },
  );
  if (changed?.slotId)
    await Slot.updateOne(
      { _id: changed.slotId, reservedCount: { $gt: 0 } },
      { $inc: { reservedCount: -1 } },
      { session },
    );
  return changed;
}
export async function expireUnpaidBooking(bookingId: string) {
  const db = await connectDB();
  return db.connection.transaction(async (session) => {
    const booking = await Booking.findOne({
      _id: bookingId,
      status: "pending_payment",
      paymentStatus: "pending",
      slotReleasedAt: { $exists: false },
    }).session(session);
    if (!booking) return;
    return releaseBookingSlot(bookingId, "expired", session);
  });
}
// Reconcile from authoritative rows, so even a hold deleted by an old TTL index
// cannot strand slot capacity. Reservation creation uses the same slot lock.
export async function releaseExpiredHolds() {
  const db = await connectDB();
  const now = new Date();
  const stale = await Booking.find({
    status: "pending_payment",
    paymentStatus: "pending",
    slotReleasedAt: { $exists: false },
    $or: [
      { checkoutExpiresAt: { $lte: now } },
      {
        checkoutExpiresAt: { $exists: false },
        createdAt: { $lte: new Date(now.getTime() - 3600_000) },
      },
    ],
  })
    .select("_id")
    .limit(150)
    .lean();
  for (const booking of stale) await expireUnpaidBooking(String(booking._id));
  await Hold.updateMany(
    { status: "active", expiresAt: { $lte: now } },
    { $set: { status: "expired" } },
  );
  const slots = await Slot.find({
    start: { $gt: now },
    reservedCount: { $gt: 0 },
  })
    .select("_id")
    .limit(500)
    .lean();
  for (const slot of slots)
    await db.connection.transaction(async (session) => {
      const current = await Slot.findById(slot._id).session(session);
      if (!current) return;
      const holds = await Hold.countDocuments({
        slotId: slot._id,
        status: "active",
        expiresAt: { $gt: new Date() },
      }).session(session);
      const bookings = await Booking.countDocuments({
        slotId: slot._id,
        status: { $nin: ["cancelled", "expired"] },
        slotReleasedAt: { $exists: false },
      }).session(session);
      const count = holds + bookings;
      if (current.reservedCount !== count)
        await Slot.updateOne(
          { _id: slot._id },
          { $set: { reservedCount: count } },
          { session },
        );
    });
}
