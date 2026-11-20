import { z } from "zod";
import { DriverApplication, UploadAsset } from "@/lib/operations/models";
import { connectDB } from "@/lib/db";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { ownAssets } from "@/lib/operations/assets";
import { audit, notify } from "@/lib/operations/events";
import { objectId } from "@/lib/operations/validation";
import { ensureSameOrigin, fail, ok, errorResponse } from "@/lib/http";
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("drivers");
    const id = objectId.parse((await params).id);
    const data = z
      .object({
        version: z.number().int().nonnegative(),
        vehicleRegistration: z.string().min(2).max(20),
        vehicleMakeModel: z.string().min(2).max(100),
        vehicleClass: z.string().min(1).max(80),
        vanSize: z.string().min(2).max(80),
        maximumWeightKg: z.number().positive().max(44000),
        capacityKg: z.number().positive().max(30000),
        capacityM3: z.number().positive().max(100),
        insuranceExpiresAt: z.string().date(),
        motExpiresAt: z.string().date(),
        vehicleTaxConfirmed: z.literal(true),
        documents: z
          .array(
            z.object({
              kind: z.enum([
                "insurance",
                "mot",
                "vehicle_front",
                "vehicle_side",
                "vehicle_load",
              ]),
              assetId: objectId,
            }),
          )
          .length(5),
        note: z.string().min(5).max(2000),
      })
      .refine(
        (value) => value.capacityKg <= value.maximumWeightKg,
        "Load capacity cannot exceed vehicle weight",
      )
      .refine(
        (value) => new Set(value.documents.map((doc) => doc.kind)).size === 5,
        "All five vehicle evidence types are required",
      )
      .parse(await req.json());
    await ownAssets(
      data.documents.map((doc) => doc.assetId),
      user.id,
      "driver_document",
    );
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      const app = await DriverApplication.findOne({
        _id: id,
        version: data.version,
        ownsVan: false,
        status: { $nin: ["draft", "active"] },
      }).session(session);
      requireCondition(
        app,
        "Application changed, is active, or does not require a company vehicle",
        409,
      );
      requireCondition(
        String(app.userId) !== user.id,
        "You cannot assign your own company vehicle",
        403,
      );
      const { version, documents, note, ...vehicle } = data;
      void version;
      const retained = app.documents.filter(
        (doc) =>
          ![
            "insurance",
            "mot",
            "vehicle_front",
            "vehicle_side",
            "vehicle_load",
          ].includes(doc.kind ?? ""),
      );
      const changed = await DriverApplication.updateOne(
        { _id: id, version: data.version },
        {
          $set: {
            ...vehicle,
            insuranceExpiresAt: new Date(vehicle.insuranceExpiresAt),
            motExpiresAt: new Date(vehicle.motExpiresAt),
            workModel: "company_vehicle",
            status: "vehicle_review",
            documents: [...retained, ...documents],
            "checks.vehicle": false,
            "checks.insurance": false,
            online: false,
          },
          $inc: { version: 1 },
        },
        { session },
      );
      requireCondition(changed.modifiedCount, "Application changed", 409);
      await UploadAsset.updateMany(
        { _id: { $in: documents.map((doc) => doc.assetId) }, ownerId: user.id },
        { $set: { ownerId: app.userId } },
        { session },
      );
      await audit(
        user.id,
        "driver.company_vehicle_assigned",
        id,
        { note, registration: data.vehicleRegistration },
        session,
      );
      await notify(
        {
          key: `company-vehicle:${id}:${data.version}`,
          event: "company_vehicle",
          reference: id,
          recipientId: String(app.userId),
          subject: "Company vehicle information added",
          message:
            "Our team has added company-vehicle details. Insurance and vehicle checks still require independent sign-off.",
          href: "/driver/apply",
        },
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
