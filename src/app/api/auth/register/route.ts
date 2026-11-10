import { registerSchema } from "@/lib/validation";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession } from "@/lib/auth";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
import bcrypt from "bcryptjs";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = registerSchema.parse(await req.json());
    await connectDB();
    if (await User.exists({ email: data.email }))
      return fail("This email is already registered", 409);
    const user = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: await bcrypt.hash(data.password, 12),
      role: "customer",
    });
    await createSession({ id: String(user.id), role: "customer" });
    return ok(
      {
        user: {
          id: String(user.id),
          name: user.name,
          email: user.email,
          role: user.role,
        },
      },
      201,
    );
  } catch (e) {
    return errorResponse(e);
  }
}
