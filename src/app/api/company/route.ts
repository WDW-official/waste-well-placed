import { connectDB } from "@/lib/db";
import { CompanyProfile } from "@/lib/workflow-models";
import { ok, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    await connectDB();
    return ok({
      company: await CompanyProfile.findOne({ key: "company", approved: true })
        .select(
          "legalName address companyNumber vatNumber carrierNumber email phone cancellationPolicy termsText privacyText",
        )
        .lean(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
