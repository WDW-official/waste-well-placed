import { facilitySchema } from "@/lib/operations/validation";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { Facility } from "@/lib/operations/models";
import { connectDB } from "@/lib/db";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("verify");
    const data = facilitySchema.parse(await req.json());
    requireCondition(
      new Date(data.expiresAt).getTime() > Date.now(),
      "Facility check must be in date",
    );
    await connectDB();
    const facility = await Facility.create({
      ...data,
      checkedAt: new Date(),
      verifiedBy: user.id,
    });
    await audit(user.id, "facility.created", String(facility._id), {
      permitReference: data.permitReference,
    });
    return ok({ id: String(facility._id) }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
