import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { configureCloudinary } from "@/lib/cloudinary";
import { Booking, Quote } from "@/lib/models";
import { Evidence, UploadAsset } from "@/lib/operations/models";
import { guestIdentity } from "@/lib/operations/assets";
import { permitted } from "@/lib/operations/policy";
import { hashToken, requireCondition } from "@/lib/operations/security";
import { objectId } from "@/lib/operations/validation";
import { audit } from "@/lib/operations/events";
import { errorResponse } from "@/lib/http";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = objectId.parse((await params).id);
    await connectDB();
    const asset = await UploadAsset.findOne({
      _id: id,
      deletedAt: { $exists: false },
    }).lean();
    requireCondition(asset, "File not found", 404);
    const user = await getSession();
    const guestId = await guestIdentity();
    let allowed =
      !!(user && String(asset.ownerId) === user.id) ||
      !!(guestId && asset.guestId === guestId);
    if (user && asset.purpose === "driver_document")
      allowed ||= permitted(user.role, "drivers");
    else if (user)
      allowed ||=
        permitted(user.role, "operations") || permitted(user.role, "verify");
    if (asset.bookingId && user) {
      const booking = await Booking.findById(asset.bookingId)
        .select("userId assignedCrewId status")
        .lean();
      if (booking) {
        if (
          String(booking.assignedCrewId) === user.id &&
          [
            "assigned",
            "en_route",
            "arrived",
            "collected",
            "at_facility",
            "evidence_submitted",
          ].includes(booking.status) &&
          asset.purpose !== "driver_document"
        )
          allowed = true;
        if (String(booking.userId) === user.id) {
          if (asset.purpose === "quote") allowed = true;
          else
            allowed ||= !!(await Evidence.exists({
              bookingId: booking._id,
              status: "verified",
            }));
        }
      }
    }
    if (asset.quoteId) {
      const quote = await Quote.findById(asset.quoteId)
        .select("+accessTokenHash ownerId accessTokenExpiresAt")
        .lean();
      const token = new URL(req.url).searchParams.get("token");
      allowed ||= !!(
        quote &&
        ((user && String(quote.ownerId) === user.id) ||
          (token &&
            quote.accessTokenHash === hashToken(token) &&
            quote.accessTokenExpiresAt &&
            quote.accessTokenExpiresAt.getTime() > Date.now()))
      );
    }
    requireCondition(allowed, "File is private", 403);
    const cloudinary = configureCloudinary();
    const url = cloudinary.utils.private_download_url(
      asset.publicId,
      asset.format ?? "jpg",
      {
        type: "authenticated",
        resource_type: asset.resourceType === "raw" ? "raw" : "image",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        attachment: asset.mime === "application/pdf",
      },
    );
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    requireCondition(response.ok, "File is temporarily unavailable", 503);
    await audit(user?.id ?? "guest", "asset.viewed", id);
    return new Response(response.body, {
      headers: {
        "Content-Type": asset.mime ?? "application/octet-stream",
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        ...(asset.mime === "application/pdf"
          ? { "Content-Disposition": 'attachment; filename="document.pdf"' }
          : {}),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
