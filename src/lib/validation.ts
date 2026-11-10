import { z } from "zod";
export const postcode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    /^(GIR\s?0AA|(?:[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}))$/i,
    "Enter a valid UK postcode",
  );
export const addressSchema = z.object({
  line1: z.string().trim().min(4).max(180),
  city: z.string().trim().min(2).max(100),
  postcode,
  notes: z.string().max(500).optional().default(""),
});
const optionalQuoteAddress = z.object({
  line1: z
    .string()
    .trim()
    .max(180)
    .refine(
      (value) => !value || value.length >= 4,
      "Enter a full street address",
    )
    .default(""),
  city: z
    .string()
    .trim()
    .max(100)
    .refine((value) => !value || value.length >= 2, "Enter a town or city")
    .default(""),
  postcode: postcode.or(z.literal("")).default(""),
  notes: z.string().max(500).default(""),
});
export const quoteRequestSchema = z.object({
  kind: z.literal("photo"),
  name: z.string().trim().max(100).default(""),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(8).max(30),
  type: z.enum(["home", "business"]),
  address: optionalQuoteAddress.default({}),
  notes: z.string().trim().min(10).max(3000),
  timing: z
    .enum(["asap", "next-few-days", "week-plus", "not-sure"])
    .default("not-sure"),
  collectionDetails: z
    .object({
      propertyType: z.enum(["house", "flat", "office", "other"]).optional(),
      floor: z.string().trim().max(80).default(""),
      parking: z.string().trim().max(500).default(""),
    })
    .default({}),
  photos: z
    .array(
      z.object({
        publicId: z.string().startsWith("waste-well-placed/"),
        secureUrl: z.string().url().startsWith("https://res.cloudinary.com/"),
      }),
    )
    .max(8),
  consent: z.literal(true),
});
export const estimateSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("load"),
    postcode,
    loadKey: z.string(),
    stairs: z.boolean().default(false),
    longCarry: z.boolean().default(false),
    specialHandling: z.boolean().default(false),
  }),
  z.object({
    kind: z.literal("items"),
    postcode,
    items: z
      .array(
        z.object({ key: z.string(), qty: z.number().int().min(1).max(20) }),
      )
      .min(1)
      .max(40),
    stairs: z.boolean().default(false),
    longCarry: z.boolean().default(false),
    specialHandling: z.boolean().default(false),
  }),
]);
export const bookingSchema = estimateSchema.and(
  z.object({
    contact: z
      .object({
        name: z.string().trim().min(2).max(100),
        email: z.string().email().max(254),
        phone: z.string().min(8).max(30),
        business: z.boolean(),
        whatsapp: z.boolean(),
      })
      .optional(),
    photos: z
      .array(
        z.object({
          publicId: z.string().startsWith("waste-well-placed/"),
          secureUrl: z.string().url().startsWith("https://res.cloudinary.com/"),
        }),
      )
      .max(8)
      .optional(),
    address: addressSchema,
    slotId: z.string().regex(/^[a-f\d]{24}$/i),
    holdId: z.string().regex(/^[a-f\d]{24}$/i),
    idempotencyKey: z.string().uuid(),
    notes: z.string().max(1000).optional(),
  }),
);
export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z
    .string()
    .email()
    .transform((x) => x.toLowerCase()),
  phone: z.string().max(30).optional(),
  password: z.string().min(12).max(120),
});
export const enquirySchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().max(30).optional(),
  company: z.string().max(160).optional(),
  type: z.enum(["business", "contact", "coverage"]),
  message: z.string().min(10).max(4000),
});
