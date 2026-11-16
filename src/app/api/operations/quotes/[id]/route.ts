import { requireUser, requireCondition } from "@/lib/operations/security";
import { objectId } from "@/lib/operations/validation";
import { connectDB } from "@/lib/db";
import { Quote, Audit } from "@/lib/models";
import { errorResponse, ok } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireUser("operations");
    await connectDB();
    const id = objectId.parse((await params).id);
    const quote = await Quote.findById(id).lean();
    requireCondition(quote, "Quote not found", 404);
    const history = await Audit.find({ entityId: id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return ok({ quote, history });
  } catch (error) {
    return errorResponse(error);
  }
}
