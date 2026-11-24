import { estimateSchema } from "@/lib/validation";
import { findZone } from "@/lib/coverage";
import { quotePrice } from "@/lib/catalog";
import { ok, errorResponse, fail, ensureSameOrigin } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const payload = estimateSchema.parse(await req.json());
    const zone = await findZone(payload.postcode);
    if (payload.specialHandling)
      return fail(
        "Special handling requires a manual quote; please use photo quote",
        422,
      );
    const estimate = await quotePrice(payload, zone?.surchargeMinor ?? 0);
    return ok({
      estimate,
      zone: zone
        ? { id: String(zone._id), name: zone.name }
        : { id: null, name: "UK-wide collections" },
    });
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("Unknown"))
      return fail(e.message, 422);
    return errorResponse(e);
  }
}
