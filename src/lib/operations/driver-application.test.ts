import { describe, expect, it } from "vitest";
import { applicationSchema, driverRegistrationSchema } from "./validation";
import { eligibilityProblems } from "./policy";

const registration = {
  name: "Test Applicant",
  email: "applicant@example.test",
  phone: "07123456789",
  basedIn: "London",
  postcode: "E1 6AN",
  hasFullUkLicence: true,
  ownsVan: false,
};
const application = {
  legalName: registration.name,
  phone: registration.phone,
  postcode: registration.postcode,
  basedIn: registration.basedIn,
  hasFullUkLicence: true,
  ownsVan: false,
  dateOfBirth: "1990-01-01",
  licenceCountry: "United Kingdom",
  licenceCategories: ["B"],
  yearsHeld: 10,
  licenceLastEight: "TEST1234",
  dvlaCheckCode: "TEST-CODE",
  points: 0,
  disqualified: false,
  endorsements: "None",
  licenceExpiresAt: "2035-01-01",
  carrierReference: "TEST-CARRIER",
  carrierRelationship: "Subject to company review",
  carrierExpiresAt: "2035-01-01",
  coveragePrefixes: ["E1"],
  wasteTypes: ["mixed"],
  workModel: "company_vehicle",
  availableDays: [1, 2, 3, 4, 5],
  availableFrom: "08:00",
  availableUntil: "18:00",
  consents: { privacy: true, checks: true, safety: true, contract: true },
  documents: ["identity", "licence", "carrier"].map((kind, index) => ({
    kind,
    assetId: String(index + 1).repeat(24),
  })),
};

describe("application-first driver eligibility", () => {
  it("accepts an application start without a password or an owned van", () => {
    expect(driverRegistrationSchema.parse(registration)).toMatchObject({
      ownsVan: false,
      hasFullUkLicence: true,
    });
  });
  it("rejects missing or negative full-UK-licence answers", () => {
    for (const hasFullUkLicence of [undefined, false]) {
      expect(
        driverRegistrationSchema.safeParse({
          ...registration,
          hasFullUkLicence,
        }).success,
      ).toBe(false);
      expect(
        applicationSchema.safeParse({ ...application, hasFullUkLicence })
          .success,
      ).toBe(false);
    }
  });
  it("requires both van model and size for van owners", () => {
    expect(
      driverRegistrationSchema.safeParse({ ...registration, ownsVan: true })
        .success,
    ).toBe(false);
    expect(
      driverRegistrationSchema.safeParse({
        ...registration,
        ownsVan: true,
        vehicleMakeModel: "Ford Transit",
        vanSize: "Large van",
      }).success,
    ).toBe(true);
  });
  it("lets a non-owner submit for company-vehicle review without fabricated vehicle records", () => {
    expect(applicationSchema.safeParse(application).success).toBe(true);
  });
  it("still requires vehicle information and evidence from an owner", () => {
    expect(
      applicationSchema.safeParse({
        ...application,
        ownsVan: true,
        workModel: "own_vehicle",
      }).success,
    ).toBe(false);
  });
  it("does not let a declared non-holder pass operational approval", () => {
    expect(
      eligibilityProblems({ status: "submitted", hasFullUkLicence: false }),
    ).toContain("A full UK driving licence is required");
  });
});
