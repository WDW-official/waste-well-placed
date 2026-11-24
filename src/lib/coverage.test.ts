import { beforeEach, describe, expect, it, vi } from "vitest";
const provider = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("@/lib/postcodes", async (original) => ({
  ...(await original<typeof import("@/lib/postcodes")>()),
  lookupPostcode: provider.lookup,
}));
import { POST } from "@/app/api/coverage/check/route";

beforeEach(() => provider.lookup.mockReset());
describe("UK-wide postcode acceptance", () => {
  it.each(["SW1A 1AA", "M1 1AE", "EH1 1YZ", "BT1 5GS"])(
    "accepts verified postcode %s without requiring a service area",
    async (postcode) => {
      provider.lookup.mockResolvedValue({
        postcode,
        country: "United Kingdom",
        district: "Test district",
        latitude: null,
        longitude: null,
      });
      const response = await POST(
        new Request("https://example.test/api/coverage/check", {
          method: "POST",
          headers: {
            origin: "https://example.test",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ postcode }),
        }),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        covered: true,
        zoneId: null,
        location: { postcode },
      });
    },
  );
});
