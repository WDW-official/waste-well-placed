import { requireUser } from "@/lib/operations/security";
import { Notification } from "@/lib/operations/models";
import { connectDB } from "@/lib/db";
import { ok, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const user = await requireUser();
    await connectDB();
    const rows = await Notification.find({ recipientId: user.id })
      .select("subject message href createdAt readAt")
      .sort({ createdAt: -1 })
      .limit(30)
      .lean();
    return ok({ rows });
  } catch (error) {
    return errorResponse(error);
  }
}
