import { connectDB } from "@/lib/db";
import { Zone } from "@/lib/models";
export function normalizePostcode(s: string) {
  return s
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/(.{3})$/, " $1");
}
export async function findZone(raw: string) {
  await connectDB();
  const postcode = normalizePostcode(raw).replace(/\s/g, "");
  const zones = await Zone.find({ active: true }).lean();
  return (
    zones.find((z) =>
      (z.prefixes as string[]).some((prefix) =>
        postcode.startsWith(prefix.toUpperCase().replace(/\s/g, "")),
      ),
    ) || null
  );
}
