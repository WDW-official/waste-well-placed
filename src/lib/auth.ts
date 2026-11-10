import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
const COOKIE = "wwp_session";
const days = 60 * 60 * 24 * 7;
const secret = () => {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32)
    throw new Error("SESSION_SECRET must contain at least 32 characters");
  return new TextEncoder().encode(s);
};
export async function createSession(user: { id: string; role: string }) {
  const jwt = await new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: days,
  });
}
export async function getSession() {
  try {
    const jwt = (await cookies()).get(COOKIE)?.value;
    if (!jwt) return null;
    const { payload } = await jwtVerify(jwt, secret());
    if (!payload.sub) return null;
    await connectDB();
    const user = await User.findById(payload.sub)
      .select("_id name email role organizationId")
      .lean();
    if (!user) return null;
    return {
      id: String(user._id),
      name: user.name as string,
      email: user.email as string,
      role: user.role as string,
      organizationId: user.organizationId ? String(user.organizationId) : null,
    };
  } catch {
    return null;
  }
}
export async function logout() {
  (await cookies()).delete(COOKIE);
}
export function isStaff(role: string) {
  return ["admin", "superadmin", "dispatcher"].includes(role);
}
