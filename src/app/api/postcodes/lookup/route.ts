import { lookupPostcode, PostcodeLookupError } from "@/lib/postcodes";
import { errorResponse, fail, ok } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("postcode") || "";
    return ok(await lookupPostcode(code));
  } catch (error) {
    if (error instanceof PostcodeLookupError) return fail(error.message, error.status);
    return errorResponse(error);
  }
}
