import { configureCloudinary } from "@/lib/cloudinary";
import { getSession } from "@/lib/auth";
import { z } from "zod";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { purpose } = z
      .object({ purpose: z.enum(["quote", "evidence"]) })
      .parse(await req.json());
    const user = await getSession();
    if (
      purpose === "evidence" &&
      (!user ||
        !["crew", "dispatcher", "admin", "superadmin"].includes(user.role))
    )
      return fail("Forbidden", 403);
    const cloudinary = configureCloudinary();
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `waste-well-placed/${purpose}`;
    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder },
      process.env.CLOUDINARY_API_SECRET!,
    );
    return ok({
      timestamp,
      folder,
      signature,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
