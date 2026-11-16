import { fail } from "@/lib/http";
export async function PATCH() {
  return fail(
    "Legacy crew updates are disabled. Use the approved driver workflow; evidence requires independent verification.",
    410,
  );
}
