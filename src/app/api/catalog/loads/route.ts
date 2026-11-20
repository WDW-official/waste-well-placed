import { loadCatalog } from "@/lib/catalog";
import { ok, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    return ok({ loads: await loadCatalog() });
  } catch (error) {
    return errorResponse(error);
  }
}
