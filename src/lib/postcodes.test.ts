import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupPostcode } from "./postcodes";

const result = { postcode: "SW1A 1AA", country: "England", admin_district: "Westminster", latitude: 51.5, longitude: -0.14 };
afterEach(() => vi.unstubAllGlobals());

describe("Postcodes.io lookup", () => {
  it("normalizes input and returns verified postcode geography", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 200, result }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupPostcode(" sw1a1aa ")).resolves.toEqual({ postcode: "SW1A 1AA", country: "England", district: "Westminster", latitude: 51.5, longitude: -0.14 });
    expect(fetchMock).toHaveBeenCalledWith("https://api.postcodes.io/postcodes/SW1A1AA", expect.objectContaining({ signal: expect.any(AbortSignal), next: { revalidate: 86400 } }));
  });

  it("rejects invalid input without calling the provider", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupPostcode("not a postcode")).rejects.toThrow("Enter a valid UK postcode");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("distinguishes unknown postcodes from service outages", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(lookupPostcode("SW1A 1AA")).rejects.toMatchObject({ status: 422 });
  });

  it.each(["network", "timeout", "server", "malformed"])("handles %s failures with a retryable error", async (failure) => {
    const fetchMock = vi.fn();
    if (failure === "network") fetchMock.mockRejectedValue(new Error("Network failure"));
    if (failure === "timeout") fetchMock.mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
    if (failure === "server") fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    if (failure === "malformed") fetchMock.mockResolvedValue(Response.json({ status: 200, result: null }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(lookupPostcode("SW1A 1AA")).rejects.toMatchObject({ status: 503, message: expect.stringContaining("temporarily unavailable") });
  });
});
