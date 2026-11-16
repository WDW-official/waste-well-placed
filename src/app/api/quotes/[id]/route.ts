import { z } from "zod";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Quote, Booking, Slot, Hold } from "@/lib/models";
import { addressSchema } from "@/lib/validation";
import { findZone } from "@/lib/coverage";
import { objectId } from "@/lib/operations/validation";
import { hashToken, requireCondition } from "@/lib/operations/security";
import { audit, notifyStaff } from "@/lib/operations/events";
import { UploadAsset } from "@/lib/operations/models";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
async function access(id: string, req: Request) {
  await connectDB();
  const quote = await Quote.findById(id).select("+accessTokenHash");
  requireCondition(quote, "Quote not found", 404);
  const user = await getSession();
  const token = new URL(req.url).searchParams.get("token");
  requireCondition(
    (user && String(quote.ownerId) === user.id) ||
      (token &&
        quote.accessTokenHash === hashToken(token) &&
        quote.accessTokenExpiresAt &&
        quote.accessTokenExpiresAt.getTime() > Date.now()),
    "This quote link is not valid",
    403,
  );
  return { quote, user };
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { quote } = await access(objectId.parse((await params).id), req);
    const value = quote.toObject();
    delete value.accessTokenHash;
    return ok({ quote: value });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const id = objectId.parse((await params).id);
    const { quote, user } = await access(id, req);
    const data = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("decline"), version: z.number().int() }),
        z.object({
          action: z.literal("accept"),
          version: z.number().int(),
          address: addressSchema,
          slotId: objectId,
          holdId: objectId,
        }),
      ])
      .parse(await req.json());
    requireCondition(
      quote.status === "awaiting_customer" &&
        quote.validUntil &&
        quote.validUntil.getTime() > Date.now(),
      "This quotation is no longer available",
      409,
    );
    if (data.action === "decline") {
      const changed = await Quote.updateOne(
        { _id: id, version: data.version, status: "awaiting_customer" },
        {
          $set: { status: "rejected" },
          $inc: { version: 1 },
          $push: {
            events: {
              action: "customer_declined",
              at: new Date(),
              actorId: user?.id ?? "customer_link",
            },
          },
        },
      );
      requireCondition(
        changed.modifiedCount,
        "Quote changed. Refresh first.",
        409,
      );
      await audit(user?.id ?? "customer_link", "quote.declined", id);
      return ok({ declined: true });
    }
    requireCondition(
      user,
      "Sign in or register with the email used for your quotation before accepting",
      401,
    );
    requireCondition(
      user.email.toLowerCase() === quote.customer?.email?.toLowerCase(),
      "Use the account matching the quotation email",
      403,
    );
    requireCondition(
      quote.totalMinor &&
        quote.priceMinor !== undefined &&
        quote.vatMinor !== undefined,
      "Quotation has no approved price",
    );
    const zone = await findZone(data.address.postcode);
    requireCondition(zone, "This postcode is outside the service area");
    const db = await connectDB();
    const booking = await db.connection.transaction(async (session) => {
      const slot = await Slot.findOne({
        _id: data.slotId,
        zoneId: zone._id,
        active: true,
        start: { $gt: new Date() },
      }).session(session);
      requireCondition(slot, "Choose an available slot");
      const hold = await Hold.findOneAndUpdate(
        {
          _id: data.holdId,
          slotId: slot._id,
          userId: user.id,
          status: "active",
          expiresAt: { $gt: new Date() },
        },
        { $set: { status: "consumed" } },
        { session },
      );
      requireCondition(hold, "Your slot hold expired. Choose again.", 409);
      const changed = await Quote.updateOne(
        {
          _id: id,
          version: data.version,
          status: "awaiting_customer",
          validUntil: { $gt: new Date() },
        },
        {
          $set: { status: "accepted", ownerId: user.id },
          $inc: { version: 1 },
          $push: {
            events: { action: "accepted", actorId: user.id, at: new Date() },
          },
        },
        { session },
      );
      requireCondition(
        changed.modifiedCount,
        "Quote already accepted or changed",
        409,
      );
      const [created] = await Booking.create(
        [
          {
            reference: quote.reference?.replace("QUOTE", "WWP"),
            userId: user.id,
            quoteId: quote._id,
            idempotencyKey: `quote:${quote._id}`,
            source: "photo_quote",
            kind: "photo",
            items: quote.lineItems.map((line, index) => ({
              key: `quoted-${index}`,
              title: line.description,
              qty: line.qty,
              unitMinor: line.unitMinor,
            })),
            contact: quote.customer,
            address: data.address,
            photos: quote.photos,
            slotId: slot._id,
            holdId: hold._id,
            scheduledAt: slot.start,
            price: {
              subtotalMinor: quote.priceMinor,
              vatMinor: quote.vatMinor,
              totalMinor: quote.totalMinor,
              surchargeMinor: 0,
            },
            status: "pending_payment",
            events: [
              {
                status: "pending_payment",
                note: "Customer accepted quotation",
                at: new Date(),
                by: user.id,
              },
            ],
          },
        ],
        { session },
      );
      await Quote.updateOne(
        { _id: id },
        { $set: { bookingId: created._id } },
        { session },
      );
      await UploadAsset.updateMany(
        { quoteId: quote._id },
        { $set: { bookingId: created._id } },
        { session },
      );
      await audit(
        user.id,
        "quote.accepted",
        id,
        { bookingId: String(created._id) },
        session,
      );
      await notifyStaff(
        `quote:${id}:accepted`,
        "quote_accepted",
        quote.reference ?? id,
        "Customer accepted the quote. Payment is pending.",
        `/admin/jobs/${created._id}`,
        session,
      );
      return created;
    });
    return ok({ bookingId: String(booking._id) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
