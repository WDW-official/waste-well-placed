import { fail } from "@/lib/http";
export async function POST() {
  return fail("Use the private /api/uploads endpoint", 410);
}
