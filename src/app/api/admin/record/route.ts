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
import { Tariff, Review } from "@/lib/workflow-models";
import { adminRecordSchemas } from "@/lib/admin-records";
import { adminEditableFields } from "@/lib/admin-resource-fields";
const models: Record<string, Model<unknown>> = {
  bookings: Booking,
  quotes: Quote,
  zones: Zone,
  slots: Slot,
  services: Service,
  catalog: Catalog,
  posts: Post,
  tariffs: Tariff,
  reviews: Review,
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
    "tariffs",
    "reviews",
  ]),
  id: z.string(),
  patch: z.record(z.unknown()),
});
export async function PATCH(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  const user = await getSession();
  if (!user || !isStaff(user.role)) return fail("Forbidden", 403);
  try {
    const { name, id, patch } = changes.parse(await req.json());
    if (!mongoose.isValidObjectId(id)) return fail("Invalid id");
    if (
      [
        "zones",
        "slots",
        "services",
        "catalog",
        "tariffs",
        "posts",
        "reviews",
      ].includes(name) &&
      !["admin", "superadmin"].includes(user.role)
    )
      return fail("Forbidden", 403);
    const fields = Object.keys(patch);
    if (
      !fields.length ||
      fields.some((k) => !adminEditableFields[name].includes(k))
    )
      return fail("Invalid update fields", 422);
    await connectDB();
    const existing = await models[name].findById(id).lean();
    if (!existing) return fail("Not found", 404);
    if (name === "slots") {
      const slot = existing as { reservedCount?: number };
      if (
        typeof patch.capacity === "number" &&
        patch.capacity < (slot.reservedCount ?? 0)
      )
        return fail("Capacity cannot be lower than current reservations", 422);
      if ((slot.reservedCount ?? 0) > 0 && ("start" in patch || "end" in patch))
        return fail(
          "Reserved slots cannot be moved. Create a new slot and review rescheduling requests instead.",
          409,
        );
    }
    if (name in adminRecordSchemas) {
      const schema =
        adminRecordSchemas[name as keyof typeof adminRecordSchemas];
      const value = { ...(existing as Record<string, unknown>), ...patch };
      for (const field of [
        "_id",
        "__v",
        "createdAt",
        "updatedAt",
        "reservedCount",
      ])
        delete value[field];
      if (name === "slots") value.zoneId = String(value.zoneId);
      schema.parse(value);
    }
    const validatedPatch =
      name === "reviews"
        ? {
            approved: z.boolean().parse(patch.approved),
            reviewedBy: user.id,
            reviewedAt: new Date(),
          }
        : patch;
    const doc = await models[name].findByIdAndUpdate(
      id,
      { $set: validatedPatch },
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
