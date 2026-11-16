import { describe, expect, it } from "vitest";
import {
  ageOn,
  availableForJob,
  driverEligible,
  eligibilityProblems,
  economics,
  permitted,
  validMilestone,
  type Eligibility,
} from "./policy";
import { parseQuoteLines } from "./quote-lines";
const now = new Date("2026-11-16T10:00:00Z");
function approved(): Eligibility {
  return {
    status: "active",
    dateOfBirth: new Date("1990-11-16"),
    points: 6,
    disqualified: false,
    licenceExpiresAt: new Date("2028-01-01"),
    insuranceExpiresAt: new Date("2028-01-01"),
    carrierExpiresAt: new Date("2028-01-01"),
    motExpiresAt: new Date("2028-01-01"),
    checks: {
      identity: true,
      licence: true,
      insurance: true,
      carrier: true,
      vehicle: true,
      contract: true,
    },
  };
}
describe("driver eligibility", () => {
  it("includes six valid points and excludes seven", () => {
    expect(driverEligible(approved(), now)).toBe(true);
    expect(driverEligible({ ...approved(), points: 7 }, now)).toBe(false);
  });
  it("checks actual birthday rather than just birth year", () => {
    expect(ageOn(new Date("2005-11-17"), now)).toBe(20);
    expect(
      driverEligible(
        { ...approved(), dateOfBirth: new Date("2005-11-17") },
        now,
      ),
    ).toBe(false);
    expect(
      driverEligible(
        { ...approved(), dateOfBirth: new Date("2005-11-16") },
        now,
      ),
    ).toBe(true);
  });
  it("blocks underage, disqualified and nonapproved applicants", () => {
    expect(driverEligible({ ...approved(), status: "submitted" }, now)).toBe(
      false,
    );
    expect(driverEligible({ ...approved(), disqualified: true }, now)).toBe(
      false,
    );
    expect(
      driverEligible(
        { ...approved(), dateOfBirth: new Date("2010-01-01") },
        now,
      ),
    ).toBe(false);
  });
  it("blocks missing human checks and expired insurance even if active", () => {
    expect(
      driverEligible(
        { ...approved(), checks: { ...approved().checks, insurance: false } },
        now,
      ),
    ).toBe(false);
    expect(
      driverEligible({ ...approved(), insuranceExpiresAt: now }, now),
    ).toBe(false);
    expect(
      eligibilityProblems({ ...approved(), carrierExpiresAt: undefined }, now),
    ).toContain("Carrier authorisation has expired or is missing");
  });
  it("honours stricter owner policy", () => {
    expect(driverEligible(approved(), now, 21, 3)).toBe(false);
  });
});
describe("role boundaries", () => {
  it("never lets drivers, customers or crew approve drivers or payouts", () => {
    for (const role of ["driver", "customer", "crew"]) {
      expect(permitted(role, "drivers")).toBe(false);
      expect(permitted(role, "finance")).toBe(false);
    }
  });
  it("separates finance, dispatch and identity checks", () => {
    expect(permitted("finance", "drivers")).toBe(false);
    expect(permitted("dispatcher", "finance")).toBe(false);
    expect(permitted("compliance", "verify")).toBe(true);
    expect(permitted("admin", "policy")).toBe(false);
    expect(permitted("superadmin", "policy")).toBe(true);
  });
});
describe("job milestones", () => {
  it("requires every custody milestone and never lets drivers self-verify", () => {
    expect(validMilestone("arrived", "collected")).toBe(true);
    expect(validMilestone("arrived", "completed")).toBe(false);
    expect(validMilestone("collected", "verified")).toBe(false);
    expect(validMilestone("at_facility", "evidence_submitted")).toBe(true);
    expect(validMilestone("evidence_submitted", "verified")).toBe(false);
  });
});
describe("net revenue and margin", () => {
  const input = {
    totalMinor: 12000,
    vatMinor: 2000,
    refundsMinor: 0,
    passThroughMinor: 0,
    disposalMinor: 2500,
    processorMinor: 300,
    contingencyMinor: 0,
    driverMinor: 4000,
    minimumMarginMinor: 3000,
  };
  it("matches the brief's illustrative net-revenue scenario", () => {
    expect(economics(input)).toEqual({
      netMinor: 10000,
      eligibleMinor: 10000,
      marginMinor: 3200,
      passes: true,
    });
  });
  it("refers an unprofitable offer for review", () => {
    expect(economics({ ...input, driverMinor: 5000 }).passes).toBe(false);
  });
  it("excludes VAT, refunds and pass-through charges from the basis", () => {
    expect(
      economics({ ...input, refundsMinor: 1000, passThroughMinor: 500 })
        .eligibleMinor,
    ).toBe(8500);
  });
  it("rejects fractional/negative/invalid pence", () => {
    expect(() => economics({ ...input, disposalMinor: 25.5 })).toThrow();
    expect(() => economics({ ...input, driverMinor: -1 })).toThrow();
    expect(() => economics({ ...input, totalMinor: Number.NaN })).toThrow();
  });
});
describe("availability and vehicle fit", () => {
  const driver = {
    availableDays: [1],
    availableFrom: "09:00",
    availableUntil: "18:00",
    coveragePrefixes: ["SW1A"],
    capacityKg: 500,
    capacityM3: 10,
    wasteTypes: ["mixed"],
  };
  const job = {
    scheduledAt: now,
    postcode: "SW1A 1AA",
    expectedWeightKg: 200,
    expectedVolumeM3: 4,
    wasteType: "mixed",
  };
  it("matches approved outward code, London hours and capacity", () => {
    expect(availableForJob(driver, job)).toBe(true);
  });
  it("blocks unsuitable loads and addresses", () => {
    expect(availableForJob(driver, { ...job, expectedWeightKg: 600 })).toBe(
      false,
    );
    expect(availableForJob(driver, { ...job, postcode: "E1 1AA" })).toBe(false);
    expect(availableForJob(driver, { ...job, wasteType: "construction" })).toBe(
      false,
    );
  });
  it("requires explicit load requirements", () => {
    expect(
      availableForJob(driver, { ...job, expectedVolumeM3: undefined }),
    ).toBe(false);
  });
  it("uses BST for summer availability", () => {
    expect(
      availableForJob(driver, {
        ...job,
        scheduledAt: new Date("2027-06-07T08:30:00Z"),
      }),
    ).toBe(true);
  });
});
describe("itemised quotations", () => {
  it("parses GBP precisely into integer pence", () => {
    expect(
      parseQuoteLines("Collection | 1 | 120.00\nAccess | 2 | 7.50"),
    ).toEqual([
      { description: "Collection", qty: 1, unitMinor: 12000 },
      { description: "Access", qty: 2, unitMinor: 750 },
    ]);
  });
  it("rejects freeform, negative and overly precise charges", () => {
    for (const text of [
      "",
      "Collection £120",
      "Collection|1|-10",
      "Collection|1|10.001",
      "Collection|0|10",
    ])
      expect(() => parseQuoteLines(text)).toThrow();
  });
});
