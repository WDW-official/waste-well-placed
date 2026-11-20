import { z } from "zod";
import { Review } from "@/lib/workflow-models";
import { Booking } from "@/lib/models";
import { connectDB } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { objectId } from "@/lib/operations/validation";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function GET() {
  try {
    await connectDB();
    const reviews = await Review.find({ approved: true })
      .select("name rating text createdAt")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ reviews });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await getSession();
    if (!user) return fail("Sign in to review a collection", 401);
    const data = z
      .object({
        bookingId: objectId,
        name: z.string().trim().min(1).max(80),
        rating: z.number().int().min(1).max(5),
        text: z.string().trim().min(10).max(2000),
        consent: z.literal(true),
      })
      .parse(await req.json());
    await connectDB();
    const booking = await Booking.exists({
      _id: data.bookingId,
      userId: user.id,
      status: { $in: ["verified", "closed"] },
    });
    if (!booking)
      return fail(
        "Only your completed verified collections can be reviewed",
        403,
      );
    await Review.create({
      ...data,
      userId: user.id,
      approved: false,
      publicationConsentAt: new Date(),
    });
    return ok({ submitted: true }, 201);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === 11000)
      return fail("This collection already has a review", 409);
    return errorResponse(error);
  }
}
