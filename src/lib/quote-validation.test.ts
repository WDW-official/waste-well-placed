import { describe, expect, it } from "vitest";
import { addressSchema, quoteRequestSchema } from "./validation";

const enquiry = {
  kind: "photo",
  type: "home",
  email: "customer@example.com",
  phone: "07123456789",
  notes: "A sofa, a wardrobe and ten bags of mixed rubbish",
  photos: [],
  consent: true,
};

describe("Free quote requests", () => {
  it("accepts an enquiry without an address or attached photos", () => {
    const result = quoteRequestSchema.parse(enquiry);
    expect(result.address.postcode).toBe("");
    expect(result.name).toBe("");
    expect(result.timing).toBe("not-sure");
  });
  it("preserves the chosen timing and optional access details", () => {
    const details = {
      propertyType: "flat",
      floor: "2nd floor, lift available",
      parking: "Visitor parking outside",
    };
    const result = quoteRequestSchema.parse({
      ...enquiry,
      timing: "week-plus",
      collectionDetails: details,
      address: { postcode: "sw1a 1aa" },
    });
    expect(result.collectionDetails).toEqual(details);
    expect(result.timing).toBe("week-plus");
    expect(result.address.postcode).toBe("SW1A 1AA");
  });
  it("rejects an invalid postcode when one is supplied", () => {
    expect(
      quoteRequestSchema.safeParse({
        ...enquiry,
        address: { postcode: "invalid" },
      }).success,
    ).toBe(false);
  });
  it("requires meaningful waste details and contact consent", () => {
    expect(
      quoteRequestSchema.safeParse({ ...enquiry, notes: "sofa" }).success,
    ).toBe(false);
    expect(
      quoteRequestSchema.safeParse({ ...enquiry, consent: false }).success,
    ).toBe(false);
  });
  it("still requires a complete address for instant bookings", () => {
    expect(addressSchema.safeParse({ postcode: "SW1A 1AA" }).success).toBe(
      false,
    );
  });
  it("continues accepting the previous full-address quote payload", () => {
    expect(
      quoteRequestSchema.safeParse({
        ...enquiry,
        name: "Test Customer",
        address: {
          line1: "10 Test Street",
          city: "London",
          postcode: "SW1A 1AA",
          notes: "",
        },
      }).success,
    ).toBe(true);
  });
});
