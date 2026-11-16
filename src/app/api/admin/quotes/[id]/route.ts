import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Quote } from "@/lib/models";
import {
  requireUser,
  requireCondition,
  newToken,
  hashToken,
} from "@/lib/operations/security";
import { objectId, pence } from "@/lib/operations/validation";
import { audit, notify } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("operations");
    const id = objectId.parse((await params).id);
    const data = z
      .object({
        status: z.enum([
          "reviewing",
          "awaiting_customer",
          "rejected",
          "expired",
        ]),
        version: z.number().int().nonnegative(),
        priceMinor: pence.optional(),
        lineItems: z
          .array(
            z.object({
              description: z.string().min(1).max(300),
              qty: z.number().int().min(1).max(100),
              unitMinor: pence,
            }),
          )
          .min(1)
          .max(40)
          .optional(),
        vatMinor: pence.optional(),
        validUntil: z.string().datetime().optional(),
        note: z.string().max(1000).default(""),
      })
      .parse(await req.json());
    if (data.status === "awaiting_customer")
      requireCondition(
        data.priceMinor &&
          data.vatMinor !== undefined &&
          data.validUntil &&
          new Date(data.validUntil).getTime() > Date.now(),
        "A price, VAT amount and future expiry are required",
      );
    if (data.status === "awaiting_customer")
      requireCondition(
        data.lineItems &&
          data.lineItems.reduce(
            (sum, line) => sum + line.qty * line.unitMinor,
            0,
          ) === data.priceMinor,
        "Itemised charges must match the collection price",
      );
    const db = await connectDB();
    const token = newToken();
    await db.connection.transaction(async (session) => {
      const revision =
        data.status === "awaiting_customer"
          ? {
              priceMinor: data.priceMinor!,
              vatMinor: data.vatMinor!,
              totalMinor: data.priceMinor! + data.vatMinor!,
              validUntil: new Date(data.validUntil!),
              actorId: user.id,
              at: new Date(),
              lineItems: data.lineItems,
            }
          : undefined;
      const quote = await Quote.findOneAndUpdate(
        {
          _id: id,
          version: data.version,
          status: { $in: ["new", "reviewing", "awaiting_customer"] },
        },
        {
          $set: {
            status: data.status,
            ...(revision
              ? {
                  lineItems: revision.lineItems,
                  priceMinor: revision.priceMinor,
                  vatMinor: revision.vatMinor,
                  totalMinor: revision.totalMinor,
                  validUntil: revision.validUntil,
                  accessTokenHash: hashToken(token),
                  accessTokenExpiresAt: new Date(Date.now() + 30 * 86400_000),
                }
              : {}),
          },
          $inc: { version: 1 },
          $push: {
            events: { action: data.status, actorId: user.id, at: new Date() },
            ...(revision ? { revisions: revision } : {}),
          },
        },
        { new: true, session },
      );
      requireCondition(
        quote,
        "Quote changed or cannot be edited. Refresh and try again.",
        409,
      );
      await audit(
        user.id,
        `quote.${data.status}`,
        id,
        { version: data.version, note: data.note },
        session,
      );
      if (revision)
        await notify(
          {
            key: `quote:${id}:issued:${quote.version}`,
            event: "quote_issued",
            reference: quote.reference ?? id,
            subject: "Your Waste Well Placed quote is ready",
            message: `Your quotation ${quote.reference} is ready to review. It expires on ${revision.validUntil.toLocaleDateString("en-GB", { timeZone: "Europe/London" })}.`,
            href: `/quote/${id}?token=${token}`,
            email: quote.customer?.email ?? undefined,
            recipientId: quote.ownerId ? String(quote.ownerId) : undefined,
          },
          session,
        );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
