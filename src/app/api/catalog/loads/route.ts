import { loadCatalog } from "@/lib/catalog";
import { ok, errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const response = ok({ loads: await loadCatalog() });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
