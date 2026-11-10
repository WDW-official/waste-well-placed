import { bookingSchema } from "@/lib/validation";
import { getSession } from "@/lib/auth";
import { findZone } from "@/lib/coverage";
import { priceEstimate } from "@/lib/pricing";
import { connectDB } from "@/lib/db";
import { Booking, Hold, Slot, Audit } from "@/lib/models";
import { newRef } from "@/lib/utils";
import { ok, errorResponse, fail, ensureSameOrigin } from "@/lib/http";
export async function GET() {
  const user = await getSession();
  if (!user) return fail("Authentication required", 401);
  await connectDB();
  const rows = await Booking.find({ userId: user.id })
    .sort({ createdAt: -1 })
    .limit(100)
    .select(
      "reference status paymentStatus scheduledAt price createdAt address",
    )
    .lean();
  return ok({ bookings: rows.map((b) => ({ ...b, id: String(b._id) })) });
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await getSession();
    if (!user) return fail("Log in or register before checkout", 401);
    const data = bookingSchema.parse(await req.json());
    if (
      data.postcode.replace(/\s/g, "") !==
      data.address.postcode.replace(/\s/g, "")
    )
      return fail("Postcode mismatch", 422);
    await connectDB();
    const prior = await Booking.findOne({
      idempotencyKey: data.idempotencyKey,
      userId: user.id,
    });
    if (prior)
      return ok({
        bookingId: String(prior._id),
        reference: prior.reference,
        existing: true,
      });
    const zone = await findZone(data.postcode);
    if (!zone) return fail("Outside the service area", 422);
    if (data.specialHandling)
      return fail("Special waste needs manual review", 422);
    const hold = await Hold.findOne({
      _id: data.holdId,
      userId: user.id,
      slotId: data.slotId,
      status: "active",
      expiresAt: { $gt: new Date() },
    });
    if (!hold)
      return fail(
        "Slot hold is missing or expired. Please choose a new slot.",
        409,
      );
    const slot = await Slot.findOne({
      _id: data.slotId,
      zoneId: zone._id,
      start: { $gt: new Date() },
      active: true,
    });
    if (!slot) return fail("Slot is no longer available", 409);
    const estimate = priceEstimate(data, zone.surchargeMinor);
    const booked = await Booking.create({
      reference: newRef(),
      userId: user.id,
      kind: data.kind,
      items: estimate.lines.map((x, i) => ({
        key: data.kind === "items" ? data.items[i]?.key : data.loadKey,
        title: x.title,
        qty: x.qty,
        unitMinor: x.unitMinor,
      })),
      contact: data.contact,
      photos: data.photos,
      loadKey: data.kind === "load" ? data.loadKey : null,
      address: data.address,
      slotId: slot._id,
      holdId: hold._id,
      scheduledAt: slot.start,
      price: estimate,
      paymentStatus: "pending",
      status: "pending_payment",
      events: [{ status: "pending_payment", at: new Date(), by: user.id }],
      idempotencyKey: data.idempotencyKey,
    });
    await Hold.updateOne(
      { _id: hold.id, status: "active" },
      { $set: { status: "consumed" } },
    );
    await Audit.create({
      actorId: user.id,
      action: "booking.created",
      entity: "booking",
      entityId: String(booked.id),
    });
    return ok(
      {
        bookingId: String(booked.id),
        reference: booked.reference,
        totalMinor: estimate.totalMinor,
      },
      201,
    );
  } catch (e) {
    if (e instanceof Error && e.message.includes("E11000"))
      return fail("Booking already created; refresh your account", 409);
    return errorResponse(e);
  }
}
