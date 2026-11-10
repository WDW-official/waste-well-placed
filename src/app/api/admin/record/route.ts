import type { Model } from "mongoose";
import { getSession, isStaff } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import {
  Booking,
  Quote,
  Zone,
  Slot,
  Service,
  Catalog,
  Post,
  Audit,
} from "@/lib/models";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
import { z } from "zod";
import mongoose from "mongoose";
const models: Record<string, Model<unknown>> = {
  bookings: Booking,
  quotes: Quote,
  zones: Zone,
  slots: Slot,
  services: Service,
  catalog: Catalog,
  posts: Post,
} as unknown as Record<string, Model<unknown>>;
const changes = z.object({
  name: z.enum([
    "bookings",
    "quotes",
    "zones",
    "slots",
    "services",
    "catalog",
    "posts",
  ]),
  id: z.string(),
  patch: z.record(z.unknown()),
});
const ALLOWED: { [key: string]: string[] } = {
  bookings: ["assignedCrewId", "notes"],
  quotes: ["status", "priceMinor", "vatMinor", "totalMinor", "validUntil"],
  zones: [
    "name",
    "prefixes",
    "active",
    "surchargeMinor",
    "allowedDays",
    "capacity",
  ],
  slots: ["start", "end", "active", "capacity"],
  services: [
    "title",
    "description",
    "image",
    "active",
    "sortOrder",
    "basePriceMinor",
  ],
  catalog: ["title", "category", "priceMinor", "active"],
  posts: ["title", "excerpt", "body", "image", "published"],
};
export async function PATCH(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  const user = await getSession();
  if (!user || !isStaff(user.role)) return fail("Forbidden", 403);
  try {
    const { name, id, patch } = changes.parse(await req.json());
    if (!mongoose.isValidObjectId(id)) return fail("Invalid id");
    if (
      ["zones", "slots", "services", "catalog", "posts"].includes(name) &&
      !["admin", "superadmin"].includes(user.role)
    )
      return fail("Forbidden", 403);
    const fields = Object.keys(patch);
    if (!fields.length || fields.some((k) => !ALLOWED[name].includes(k)))
      return fail("Invalid update fields", 422);
    await connectDB();
    const doc = await models[name].findByIdAndUpdate(
      id,
      { $set: patch },
      { new: true, runValidators: true },
    );
    if (!doc) return fail("Not found", 404);
    await Audit.create({
      actorId: user.id,
      action: `${name}.update`,
      entity: name,
      entityId: id,
      detail: { fields },
    });
    return ok({ updated: true });
  } catch (e) {
    return errorResponse(e);
  }
}
