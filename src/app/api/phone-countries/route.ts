import { NextResponse } from "next/server";
import { getPhoneCountries } from "@/lib/phone-countries";

export function GET() {
  return NextResponse.json(
    { countries: getPhoneCountries() },
    {
      headers: {
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    },
  );
}
