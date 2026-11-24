import { rateLimit } from "@/lib/operations/rate-limit";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { createSession } from "@/lib/auth";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
import bcrypt from "bcryptjs";
import { requireLoginConfiguration } from "@/lib/login-configuration";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  let stage = "request validation";
  try {
    const { email, password } = z
      .object({ email: z.string().email(), password: z.string().max(120) })
      .parse(await req.json());
    stage = "server configuration";
    requireLoginConfiguration();
    stage = "database connection";
    await connectDB();
    stage = "login rate limit";
    await rateLimit(req, "customer-login", 20);
    stage = "account lookup";
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      "+passwordHash",
    );
    stage = "password verification";
    if (
      !user ||
      user.driverPasswordPending ||
      !(await bcrypt.compare(password, user.passwordHash))
    )
      return fail("Invalid email or password", 401);
    stage = "session creation";
    await createSession({ id: String(user.id), role: user.role });
    return ok({
      user: {
        id: String(user.id),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (e) {
    if (
      e instanceof z.ZodError ||
      (e instanceof Error && "status" in e && typeof e.status === "number")
    )
      return errorResponse(e);
    if (stage === "request validation" && e instanceof SyntaxError)
      return fail("Invalid request body", 400);
    // Keep credentials and connection strings out of login diagnostics.
    console.error("Login failed:", {
      stage,
      errorType: e instanceof Error ? e.name : "UnknownError",
    });
    return fail(
      "Sign-in is temporarily unavailable. Please try again later.",
      503,
    );
  }
}
