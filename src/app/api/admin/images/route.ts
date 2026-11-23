import { randomUUID } from "node:crypto";
import type { UploadApiResponse } from "cloudinary";
import { getSession } from "@/lib/auth";
import { configureCloudinary, cloudinaryUploadError } from "@/lib/cloudinary";
import { connectDB } from "@/lib/db";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
import { rateLimit } from "@/lib/operations/rate-limit";
import { requireCondition } from "@/lib/operations/security";
import { audit } from "@/lib/operations/events";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await getSession();
    requireCondition(
      user && ["admin", "superadmin"].includes(user.role),
      "Administrator access required",
      403,
    );
    requireCondition(
      Number(req.headers.get("content-length") ?? 0) < 3_300_000,
      "Choose an image under 3 MB",
      413,
    );
    const form = await req.formData();
    const file = form.get("file");
    requireCondition(
      file instanceof File && file.size > 0 && file.size <= 3_000_000,
      "Choose an image under 3 MB",
      422,
    );
    const bytes = Buffer.from(await file.arrayBuffer());
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp =
      bytes.subarray(0, 4).toString() === "RIFF" &&
      bytes.subarray(8, 12).toString() === "WEBP";
    requireCondition(
      (jpeg && file.type === "image/jpeg") ||
        (png && file.type === "image/png") ||
        (webp && file.type === "image/webp"),
      "Choose a JPEG, PNG or WebP image",
      422,
    );
    await connectDB();
    await rateLimit(req, "admin-image-upload", 40);
    const cloudinary = configureCloudinary();
    const uploaded = await new Promise<UploadApiResponse>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: `waste-well-placed/content/${randomUUID()}`,
          resource_type: "image",
          type: "upload",
          overwrite: false,
          timeout: 20000,
        },
        (error, result) =>
          error || !result
            ? reject(
                cloudinaryUploadError(error ?? Error("Image upload failed")),
              )
            : resolve(result),
      );
      stream.end(bytes);
    });
    await audit(user.id, "content.image_uploaded", uploaded.public_id);
    return ok({ secureUrl: uploaded.secure_url }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
