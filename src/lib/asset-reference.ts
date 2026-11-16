import { z } from "zod";
export const photoReference = z.object({
  publicId: z.string().startsWith("waste-well-placed/"),
  secureUrl: z
    .string()
    .refine(
      (value) =>
        /^\/api\/assets\/[a-f\d]{24}$/i.test(value) ||
        value.startsWith("https://res.cloudinary.com/"),
      "Invalid photo reference",
    ),
});
