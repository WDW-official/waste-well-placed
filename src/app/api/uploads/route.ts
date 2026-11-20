import { rateLimit } from "@/lib/operations/rate-limit";
import { randomUUID } from "node:crypto";
import type { UploadApiResponse } from "cloudinary";
import { getSession } from "@/lib/auth";
import { cloudinaryUploadError, configureCloudinary } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db";
import { UploadAsset } from "@/lib/operations/models";
import { guestIdentity } from "@/lib/operations/assets";
import { permitted } from "@/lib/operations/policy";
import { requireCondition } from "@/lib/operations/security";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    requireCondition(
      Number(req.headers.get("content-length") ?? 0) < 3_300_000,
      "File must be under 3 MB",
      413,
    );
    const form = await req.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose"));
    requireCondition(
      ["quote", "driver_document", "evidence", "transfer_note"].includes(
        purpose,
      ),
      "Invalid upload purpose",
    );
    const user = await getSession();
    if (purpose === "driver_document")
      requireCondition(
        user && (user.role === "driver" || permitted(user.role, "drivers")),
        "Driver or driver-reviewer account required",
        403,
      );
    if (purpose === "evidence")
      requireCondition(
        user &&
          [
            "driver",
            "admin",
            "superadmin",
            "dispatcher",
            "compliance",
          ].includes(user.role),
        "Not permitted",
        403,
      );
    if (purpose === "transfer_note")
      requireCondition(
        user && permitted(user.role, "verify"),
        "Verifier access required",
        403,
      );
    requireCondition(
      file instanceof File && file.size > 0 && file.size <= 3_000_000,
      "Choose a file under 3 MB",
    );
    const bytes = Buffer.from(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
    const pdf = bytes.subarray(0, 5).toString() === "%PDF-";
    requireCondition(
      (jpeg && file.type === "image/jpeg") ||
        (png && file.type === "image/png") ||
        (webp && file.type === "image/webp") ||
        (pdf && file.type === "application/pdf" && purpose !== "quote"),
      "Only verified JPEG, PNG, WebP or document PDFs are supported",
    );
    await connectDB();
    await rateLimit(req, "private-upload", 40);
    const guestId = user ? undefined : await guestIdentity(true);
    const identity = user ? { ownerId: user.id } : { guestId };
    const recent = await UploadAsset.countDocuments({
      ...identity,
      createdAt: { $gte: new Date(Date.now() - 3600_000) },
    });
    requireCondition(
      recent < 40,
      "Upload limit reached. Please try again later.",
      429,
    );
    const cloudinary = configureCloudinary();
    const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: `waste-well-placed/${purpose}/${randomUUID()}${pdf ? ".pdf" : ""}`,
          type: "authenticated",
          resource_type: pdf ? "raw" : "image",
          overwrite: false,
        },
        (error, result) =>
          error || !result
            ? reject(cloudinaryUploadError(error ?? Error("Upload failed")))
            : resolve(result),
      );
      stream.end(bytes);
    });
    const asset = await UploadAsset.create({
      ...identity,
      publicId: uploaded.public_id,
      format: uploaded.format ?? "",
      resourceType: uploaded.resource_type,
      purpose,
      originalName: file.name.slice(0, 160),
      mime: file.type,
      bytes: file.size,
    });
    return ok(
      {
        assetId: String(asset._id),
        publicId: asset.publicId,
        secureUrl: `/api/assets/${asset._id}`,
      },
      201,
    );
  } catch (error) {
    return errorResponse(error);
  }
}
