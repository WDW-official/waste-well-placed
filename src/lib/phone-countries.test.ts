import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/phone-countries/route";
import { getPhoneCountries, internationalPhone } from "./phone-countries";

describe("phone countries API", () => {
  it("returns country names, flags, and calling codes with cache headers", async () => {
    const response = GET();
    const { countries } = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("max-age=86400");
    expect(countries).toContainEqual({
      code: "GB",
      name: "United Kingdom",
      callingCode: "+44",
      flag: "🇬🇧",
    });
    expect(countries).toContainEqual({
      code: "NG",
      name: "Nigeria",
      callingCode: "+234",
      flag: "🇳🇬",
    });
    expect(countries.length).toBeGreaterThan(200);
  });

  it("keeps countries with a shared calling code as separate options", () => {
    const countries = getPhoneCountries();
    expect(
      countries.find((country) => country.code === "US")?.callingCode,
    ).toBe("+1");
    expect(
      countries.find((country) => country.code === "CA")?.callingCode,
    ).toBe("+1");
    expect(new Set(countries.map((country) => country.code)).size).toBe(
      countries.length,
    );
  });
});

describe("international phone numbers", () => {
  it("removes the UK national trunk prefix", () => {
    expect(internationalPhone("07123 456789", "GB")).toBe("+447123456789");
  });
  it("uses the selected country calling code", () => {
    expect(internationalPhone("0803 123 4567", "NG")).toBe("+2348031234567");
  });
  it("preserves significant Italian leading zeros", () => {
    expect(internationalPhone("02 12345678", "IT")).toBe("+390212345678");
  });
  it("honours pasted international numbers instead of adding a second prefix", () => {
    expect(internationalPhone("+1 213 373 4253", "GB")).toBe("+12133734253");
  });
  it("keeps optional empty inputs empty", () => {
    expect(internationalPhone("", "GB")).toBe("");
    expect(internationalPhone("   ", "NG")).toBe("");
  });
});
