import { lookupPostcode } from "@/lib/postcodes";
import { errorResponse, ok } from "@/lib/http";

export async function GET(req: Request) {
  try {
    const code = new URL(req.url).searchParams.get("postcode") ?? "";
    return ok(await lookupPostcode(code));
  } catch (error) {
    return errorResponse(error);
  }
}
