import { rateLimit } from "@/lib/operations/rate-limit";
import { quoteRequestSchema } from "@/lib/validation";
import { connectDB } from "@/lib/db";
import { Quote } from "@/lib/models";
import { newRef } from "@/lib/utils";
import { ok, errorResponse, fail, ensureSameOrigin } from "@/lib/http";
import { getSession } from "@/lib/auth";
import { hashToken, newToken } from "@/lib/operations/security";
import { attachPhotos } from "@/lib/operations/assets";
import { audit, notify, notifyStaff } from "@/lib/operations/events";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const payload = quoteRequestSchema.parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "quote-submit", 15);
    const user = await getSession();
    const reference = newRef("QUOTE");
    const token = newToken();
    const quote = await db.connection.transaction(async (session) => {
      const [created] = await Quote.create(
        [
          {
            reference,
            ownerId: user?.id,
            accessTokenHash: hashToken(token),
            accessTokenExpiresAt: new Date(Date.now() + 30 * 86400_000),
            customer: {
              name: payload.name,
              email: payload.email,
              phone: payload.phone,
            },
            kind: "photo",
            address: payload.address,
            details: {
              type: payload.type,
              notes: payload.notes,
              timing: payload.timing,
              collectionDetails: payload.collectionDetails,
            },
            photos: payload.photos,
            status: "new",
            events: [{ action: "submitted", at: new Date() }],
          },
        ],
        { session },
      );
      await attachPhotos(
        payload.photos,
        user?.id,
        { quoteId: String(created._id) },
        session,
      );
      const href = `/quote/${created._id}?token=${token}`;
      await notify(
        {
          key: `quote:${created._id}:submitted`,
          event: "quote_submitted",
          reference,
          subject: "Your quote request has been received",
          message: `Your reference is ${reference}. Our team will review your request. This is not yet a confirmed collection.`,
          href,
          email: payload.email,
          recipientId: user?.id,
        },
        session,
      );
      await notifyStaff(
        `quote:${created._id}:submitted`,
        "quote_submitted",
        reference,
        "Review the customer photos and request details.",
        `/admin/quotes/${created._id}`,
        session,
      );
      await audit(
        user?.id ?? "guest",
        "quote.submitted",
        String(created._id),
        {},
        session,
      );
      return created;
    });
    return ok(
      { reference, trackingUrl: `/quote/${quote._id}?token=${token}` },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
