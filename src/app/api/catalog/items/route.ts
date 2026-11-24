import { ok, errorResponse } from "@/lib/http";
import { itemCatalog } from "@/lib/catalog";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  try {
    const search = new URL(req.url).searchParams.get("q")?.toLowerCase() || "";
    const response = ok({
      items: (await itemCatalog()).filter((item) =>
        item.title.toLowerCase().includes(search),
      ),
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
