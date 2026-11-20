import { postcode } from "@/lib/validation";
import { findZone } from "@/lib/coverage";
import { lookupPostcode, PostcodeLookupError } from "@/lib/postcodes";
import { ok, errorResponse, fail, ensureSameOrigin } from "@/lib/http";
import { z } from "zod";

export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { postcode: code } = z.object({ postcode }).parse(await req.json());
    const location = await lookupPostcode(code);
    const zone = await findZone(location.postcode);
    return ok({
      covered: !!zone,
      zone: zone?.name || null,
      zoneId: zone ? String(zone._id) : null,
      location,
    });
  } catch (error) {
    if (error instanceof PostcodeLookupError)
      return fail(error.message, error.status);
    return errorResponse(error);
  }
}
