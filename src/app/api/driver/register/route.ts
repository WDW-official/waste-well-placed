import { rateLimit } from "@/lib/operations/rate-limit";
import bcrypt from "bcryptjs";
import { registerSchema } from "@/lib/validation";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { DriverApplication } from "@/lib/operations/models";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = registerSchema.parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "driver-register", 5);
    if (await User.exists({ email: data.email }))
      return fail("An account already uses this email. Sign in instead.", 409);
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await db.connection.transaction(async (session) => {
      const [created] = await User.create(
        [
          {
            name: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash,
            role: "driver",
          },
        ],
        { session },
      );
      await DriverApplication.create(
        [{ userId: created._id, legalName: data.name, phone: data.phone }],
        { session },
      );
      await audit(
        String(created._id),
        "driver.account_created",
        String(created._id),
        {},
        session,
      );
      return created;
    });
    await createSession({ id: String(user._id), role: "driver" });
    return ok({ created: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
