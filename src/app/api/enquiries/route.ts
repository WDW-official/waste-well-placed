import { enquirySchema } from "@/lib/validation";
import { connectDB } from "@/lib/db";
import { Enquiry } from "@/lib/models";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = enquirySchema.parse(await req.json());
    await connectDB();
    await Enquiry.create(data);
    return ok({ submitted: true }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
