import { z } from "zod";
import { User } from "@/lib/models";
import { getSession } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function PATCH(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await getSession();
    if (!user) return fail("Sign in to continue", 401);
    const data = z
      .object({
        name: z.string().trim().min(2).max(100),
        phone: z.string().trim().max(30),
      })
      .strict()
      .parse(await req.json());
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      await User.updateOne({ _id: user.id }, { $set: data }, { session });
      await audit(user.id, "account.profile_updated", user.id, {}, session);
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
