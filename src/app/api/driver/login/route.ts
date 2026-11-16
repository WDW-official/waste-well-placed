import { rateLimit } from "@/lib/operations/rate-limit";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession } from "@/lib/auth";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = z
      .object({ email: z.string().email(), password: z.string().max(120) })
      .parse(await req.json());
    await connectDB();
    await rateLimit(req, "driver-login", 20);
    const user = await User.findOne({
      email: data.email.toLowerCase(),
      role: "driver",
    });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash)))
      return fail("Invalid driver credentials", 401);
    await createSession({ id: String(user._id), role: "driver" });
    return ok({ signedIn: true });
  } catch (error) {
    return errorResponse(error);
  }
}
