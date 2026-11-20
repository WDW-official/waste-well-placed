import { z } from "zod";
import { defaultLoads } from "./catalog";
const money = z.number().int().min(0).max(100_000_000);
const key = z
  .string()
  .trim()
  .min(2)
  .max(100)
  .regex(/^[a-z0-9][a-z0-9-]*$/);
const image = z
  .union([
    z
      .string()
      .url()
      .max(1500)
      .refine((value) => {
        const url = new URL(value);
        return (
          url.protocol === "https:" && url.hostname === "res.cloudinary.com"
        );
      }, "Use a Cloudinary HTTPS image URL"),
    z.literal(""),
  ])
  .optional();
const areas = z
  .array(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{1,2}\d[A-Z\d]?$/),
  )
  .min(1)
  .max(100);
export const adminRecordSchemas = {
  zones: z
    .object({
      name: z.string().trim().min(2).max(100),
      prefixes: areas,
      surchargeMinor: money.default(0),
      capacity: z.number().int().min(1).max(1000).default(3),
      allowedDays: z.array(z.number().int().min(0).max(6)).optional(),
      active: z.boolean().default(true),
    })
    .strict(),
  slots: z
    .object({
      zoneId: z.string().regex(/^[a-f\d]{24}$/i),
      start: z.coerce.date(),
      end: z.coerce.date(),
      capacity: z.number().int().min(1).max(1000),
      active: z.boolean().default(true),
    })
    .strict()
    .refine((data) => data.end > data.start, {
      message: "End must be after start",
      path: ["end"],
    }),
  catalog: z
    .object({
      key,
      title: z.string().trim().min(2).max(150),
      category: z.string().trim().min(1).max(80),
      priceMinor: money,
      image,
      active: z.boolean().default(true),
    })
    .strict(),
  tariffs: z
    .object({
      key: z
        .string()
        .refine(
          (value) => defaultLoads.some((load) => load.key === value),
          "Choose an existing load key",
        ),
      title: z.string().trim().min(2).max(150),
      priceMinor: money,
      active: z.boolean().default(true),
    })
    .strict(),
  services: z
    .object({
      slug: key,
      title: z.string().trim().min(2).max(150),
      description: z.string().max(2000).optional(),
      image,
      category: z.string().max(80).optional(),
      sortOrder: z.number().int().optional(),
      basePriceMinor: money.optional(),
      active: z.boolean().default(true),
    })
    .strict(),
  posts: z
    .object({
      slug: key,
      title: z.string().trim().min(2).max(200),
      excerpt: z.string().max(2000).optional(),
      body: z.string().trim().min(10).max(100_000),
      image,
      published: z.boolean().default(false),
    })
    .strict(),
};
