import { z } from "zod";
import { postcode } from "./validation";

const lookupResponse = z.object({
  status: z.literal(200),
  result: z.object({
    postcode,
    country: z.string(),
    admin_district: z.string().nullable(),
    latitude: z.number().nullable(),
    longitude: z.number().nullable(),
  }),
});

export class PostcodeLookupError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "PostcodeLookupError";
  }
}

export async function lookupPostcode(raw: string) {
  const code = postcode.parse(raw).replace(/\s/g, "");
  try {
    const response = await fetch(
      `https://api.postcodes.io/postcodes/${encodeURIComponent(code)}`,
      { signal: AbortSignal.timeout(5000), next: { revalidate: 86400 } },
    );
    if (response.status === 404) {
      throw new PostcodeLookupError(
        "Postcode not found. Check your UK postcode and try again.",
        422,
      );
    }
    if (!response.ok) throw new Error("Postcode service unavailable");
    const { result } = lookupResponse.parse(await response.json());
    return {
      postcode: result.postcode,
      country: result.country,
      district: result.admin_district,
      latitude: result.latitude,
      longitude: result.longitude,
    };
  } catch (error) {
    if (error instanceof PostcodeLookupError) throw error;
    throw new PostcodeLookupError(
      "Postcode lookup is temporarily unavailable. Please try again shortly.",
      503,
    );
  }
}
