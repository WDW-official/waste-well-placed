import { describe, it, expect } from "vitest";
import { priceEstimate } from "./pricing";
describe("GBP pricing", () => {
  it("calculates load and VAT without trusting browser totals", () => {
    const quote = priceEstimate(
      {
        kind: "load",
        postcode: "SW1A 1AA",
        loadKey: "mini",
        stairs: false,
        longCarry: false,
        specialHandling: false,
      },
      0,
    );
    expect(quote.subtotalMinor).toBe(5900);
    expect(quote.vatMinor).toBe(1180);
    expect(quote.totalMinor).toBe(7080);
  });
  it("adds individual items", () => {
    const q = priceEstimate({
      kind: "items",
      postcode: "SW1A 1AA",
      items: [{ key: "chair", qty: 2 }],
      stairs: false,
      longCarry: false,
      specialHandling: false,
    });
    expect(q.subtotalMinor).toBe(3800);
  });
  it.each([
    ["construction-quarter", 9900, "Construction waste — quarter load"],
    ["construction-half", 15900, "Construction waste — half load"],
    ["construction-full", 31900, "Construction waste — full load"],
    ["garden-quarter", 9900, "Garden waste — quarter load"],
    ["garden-half", 15900, "Garden waste — half load"],
    ["garden-full", 31900, "Garden waste — full load"],
  ])("prices %s using the approved guide tariff", (loadKey, price, title) => {
    const quote = priceEstimate({
      kind: "load",
      postcode: "SW1A 1AA",
      loadKey: String(loadKey),
      stairs: false,
      longCarry: false,
      specialHandling: false,
    });
    expect(quote.subtotalMinor).toBe(price);
    expect(quote.lines).toEqual([{ title, qty: 1, unitMinor: price }]);
  });
  it("rejects an unsupported specialist size", () => {
    expect(() =>
      priceEstimate({
        kind: "load",
        postcode: "SW1A 1AA",
        loadKey: "construction-mini",
        stairs: false,
        longCarry: false,
        specialHandling: false,
      }),
    ).toThrow("Unknown load size");
  });
});
