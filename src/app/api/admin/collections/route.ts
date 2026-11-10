import type { Model } from "mongoose";
import { getSession, isStaff } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  Booking,
  Quote,
  User,
  Zone,
  Slot,
  Service,
  Catalog,
  Enquiry,
  Post,
  Organization,
} from "@/lib/models";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
import { z } from "zod";
const collections: Record<string, Model<unknown>> = {
  bookings: Booking,
  quotes: Quote,
  users: User,
  zones: Zone,
  slots: Slot,
  services: Service,
  catalog: Catalog,
  enquiries: Enquiry,
  posts: Post,
  organizations: Organization,
} as unknown as Record<string, Model<unknown>>;
const allowed = [
  "bookings",
  "quotes",
  "users",
  "zones",
  "slots",
  "services",
  "catalog",
  "enquiries",
  "posts",
  "organizations",
] as const;
export async function GET(req: Request) {
  try {
    const u = await getSession();
    if (!u || !isStaff(u.role)) return fail("Forbidden", 403);
    const params = new URL(req.url).searchParams;
    const name = z.enum(allowed).parse(params.get("name"));
    await connectDB();
    const page = Math.min(100, Math.max(1, Number(params.get("page") || 1)));
    const query = {};
    const rows = await collections[name]
      .find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * 20)
      .limit(20)
      .select(name === "users" ? "-passwordHash" : "")
      .lean();
    const count = await collections[name].countDocuments(query);
    return ok({ rows, count, page });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  const u = await getSession();
  if (!u || !["admin", "superadmin"].includes(u.role))
    return fail("Forbidden", 403);
  try {
    const { name, record } = z
      .object({
        name: z.enum(["zones", "slots", "services", "catalog", "posts"]),
        record: z.record(z.unknown()),
      })
      .parse(await req.json());
    await connectDB();
    const model = collections[name];
    const created = await model.create(record);
    return ok({ id: String(created._id) }, 201);
  } catch (e) {
    return errorResponse(e);
  }
}
