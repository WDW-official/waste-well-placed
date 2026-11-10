import { ok } from "@/lib/http";
import { SERVICES } from "@/lib/constants";
import { connectDB } from "@/lib/db";
import { Service } from "@/lib/models";
export async function GET() {
  try {
    await connectDB();
    const rows = await Service.find({ active: true })
      .sort({ sortOrder: 1 })
      .select("slug title description image category")
      .lean();
    return ok({ services: rows.length ? rows : SERVICES });
  } catch {
    return ok({ services: SERVICES });
  }
}
