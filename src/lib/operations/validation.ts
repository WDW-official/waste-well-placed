import { z } from "zod";
import { postcode } from "@/lib/validation";
export const objectId = z.string().regex(/^[a-f\d]{24}$/i);
export const pence = z.number().int().safe().min(0).max(100_000_000);
const date = z.string().date();
export const applicationSchema = z
  .object({
    legalName: z.string().trim().min(2).max(100),
    dateOfBirth: date,
    phone: z.string().min(8).max(30),
    postcode,
    licenceCountry: z.string().min(2).max(80),
    licenceCategories: z.array(z.string().max(15)).min(1).max(12),
    yearsHeld: z.number().int().min(0).max(80),
    licenceLastEight: z.string().trim().length(8),
    dvlaCheckCode: z.string().trim().min(4).max(30),
    points: z.number().int().min(0).max(30),
    disqualified: z.boolean(),
    endorsements: z.string().max(1000),
    licenceExpiresAt: date,
    vehicleRegistration: z.string().min(2).max(20),
    vehicleMakeModel: z.string().min(2).max(100),
    vehicleClass: z.string().min(1).max(80),
    maximumWeightKg: z.number().positive().max(44000),
    capacityKg: z.number().positive().max(30000),
    capacityM3: z.number().positive().max(100),
    insuranceExpiresAt: date,
    motExpiresAt: date,
    vehicleTaxConfirmed: z.literal(true),
    carrierReference: z.string().min(2).max(100),
    carrierRelationship: z.string().min(2).max(300),
    carrierExpiresAt: date,
    coveragePrefixes: z
      .array(
        z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-Z]{1,2}\d[A-Z\d]?$/),
      )
      .min(1)
      .max(60),
    wasteTypes: z
      .array(
        z.enum(["mixed", "furniture", "garden", "construction", "appliances"]),
      )
      .min(1),
    workModel: z.enum(["own_vehicle", "company_vehicle"]),
    availableDays: z.array(z.number().int().min(0).max(6)).min(1),
    availableFrom: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    availableUntil: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    consents: z.object({
      privacy: z.literal(true),
      checks: z.literal(true),
      safety: z.literal(true),
      contract: z.literal(true),
    }),
    documents: z
      .array(
        z.object({
          kind: z.enum([
            "identity",
            "licence",
            "insurance",
            "carrier",
            "vehicle_front",
            "vehicle_side",
            "vehicle_load",
            "mot",
          ]),
          assetId: objectId,
          expiresAt: date.optional(),
        }),
      )
      .min(8)
      .max(20),
  })
  .superRefine((data, context) => {
    if (data.capacityKg > data.maximumWeightKg)
      context.addIssue({
        code: "custom",
        path: ["capacityKg"],
        message: "Load capacity cannot exceed maximum vehicle weight",
      });
    if (data.availableFrom >= data.availableUntil)
      context.addIssue({
        code: "custom",
        path: ["availableUntil"],
        message: "End time must be after start time",
      });
    for (const kind of [
      "identity",
      "licence",
      "insurance",
      "carrier",
      "vehicle_front",
      "vehicle_side",
      "vehicle_load",
      "mot",
    ]) {
      if (!data.documents.some((document) => document.kind === kind))
        context.addIssue({
          code: "custom",
          path: ["documents"],
          message: `${kind} evidence is required`,
        });
    }
  });
export const checksSchema = z.object({
  identity: z.boolean(),
  licence: z.boolean(),
  insurance: z.boolean(),
  carrier: z.boolean(),
  vehicle: z.boolean(),
  contract: z.boolean(),
});
export const facilitySchema = z.object({
  name: z.string().min(2).max(150),
  address: z.string().min(4).max(300),
  postcode,
  permitReference: z.string().min(2).max(100),
  wasteTypes: z.array(z.string().min(1).max(50)).min(1).max(20),
  expiresAt: date,
  chargeMinor: pence,
  active: z.boolean(),
});
