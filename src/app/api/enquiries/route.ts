import { rateLimit } from "@/lib/operations/rate-limit";
import { audit, notifyStaff } from "@/lib/operations/events";
import { enquirySchema } from "@/lib/validation";
import { connectDB } from "@/lib/db";
import { Enquiry } from "@/lib/models";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = enquirySchema.parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "public-enquiry", 15);
    await db.connection.transaction(async (session) => {
      const [enquiry] = await Enquiry.create([data], { session });
      await audit(
        "public_enquiry",
        "enquiry.created",
        String(enquiry._id),
        { type: data.type },
        session,
      );
      await notifyStaff(
        `enquiry:${enquiry._id}`,
        "new_enquiry",
        String(enquiry._id),
        "A customer or business request is waiting in the enquiries queue.",
        "/admin/enquiries",
        session,
      );
    });
    return ok({ submitted: true }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
