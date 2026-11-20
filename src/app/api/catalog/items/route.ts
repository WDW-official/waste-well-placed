import { ok, errorResponse } from "@/lib/http";
import { itemCatalog } from "@/lib/catalog";
export async function GET(req: Request) {
  try {
    const search = new URL(req.url).searchParams.get("q")?.toLowerCase() || "";
    return ok({
      items: (await itemCatalog()).filter((item) =>
        item.title.toLowerCase().includes(search),
      ),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
