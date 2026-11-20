export type Permission =
  "operations" | "drivers" | "verify" | "finance" | "policy";
const permissions: Record<Permission, string[]> = {
  operations: ["admin", "superadmin", "dispatcher"],
  drivers: ["admin", "superadmin", "compliance"],
  verify: ["admin", "superadmin", "compliance"],
  finance: ["admin", "superadmin", "finance"],
  policy: ["superadmin"],
};
export function permitted(role: string, permission: Permission) {
  return permissions[permission].includes(role);
}
export function backoffice(role: string) {
  return Object.values(permissions).some((roles) => roles.includes(role));
}
export const driverMilestones = [
  "en_route",
  "arrived",
  "collected",
  "at_facility",
  "evidence_submitted",
] as const;
export type DriverMilestone = (typeof driverMilestones)[number];
const transitions: Record<string, string[]> = {
  assigned: ["en_route"],
  en_route: ["arrived"],
  arrived: ["collected"],
  collected: ["at_facility"],
  at_facility: ["evidence_submitted"],
};
export function validMilestone(from: string, to: string) {
  return transitions[from]?.includes(to) ?? false;
}
export function ageOn(dateOfBirth: Date, now: Date) {
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  if (
    now.getUTCMonth() < dateOfBirth.getUTCMonth() ||
    (now.getUTCMonth() === dateOfBirth.getUTCMonth() &&
      now.getUTCDate() < dateOfBirth.getUTCDate())
  )
    age--;
  return age;
}
export type Eligibility = {
  status: string;
  hasFullUkLicence?: boolean | null;
  dateOfBirth?: Date | null;
  points?: number | null;
  disqualified?: boolean | null;
  licenceExpiresAt?: Date | null;
  insuranceExpiresAt?: Date | null;
  carrierExpiresAt?: Date | null;
  motExpiresAt?: Date | null;
  checks?: {
    identity?: boolean | null;
    licence?: boolean | null;
    insurance?: boolean | null;
    carrier?: boolean | null;
    vehicle?: boolean | null;
    contract?: boolean | null;
  } | null;
};
export function eligibilityProblems(
  driver: Eligibility,
  now = new Date(),
  minAge = 21,
  maxPoints = 6,
) {
  const problems: string[] = [];
  if (driver.hasFullUkLicence === false)
    problems.push("A full UK driving licence is required");
  if (!driver.dateOfBirth || ageOn(driver.dateOfBirth, now) < minAge)
    problems.push(`Minimum company policy age is ${minAge}`);
  if (driver.points == null || driver.points > maxPoints || driver.points < 0)
    problems.push(`Valid licence points must be 0–${maxPoints}`);
  if (driver.disqualified !== false)
    problems.push("Driving entitlement must be confirmed");
  for (const [key, label] of [
    ["licenceExpiresAt", "Driving licence"],
    ["insuranceExpiresAt", "Insurance"],
    ["carrierExpiresAt", "Carrier authorisation"],
    ["motExpiresAt", "Vehicle roadworthiness"],
  ] as const) {
    if (!driver[key] || driver[key]!.getTime() <= now.getTime())
      problems.push(`${label} has expired or is missing`);
  }
  for (const key of [
    "identity",
    "licence",
    "insurance",
    "carrier",
    "vehicle",
    "contract",
  ] as const) {
    if (!driver.checks?.[key])
      problems.push(`${key} check needs human sign-off`);
  }
  return problems;
}
export function driverEligible(
  driver: Eligibility,
  now = new Date(),
  minAge = 21,
  maxPoints = 6,
) {
  return (
    driver.status === "active" &&
    eligibilityProblems(driver, now, minAge, maxPoints).length === 0
  );
}
export type EconomicsInput = {
  totalMinor: number;
  vatMinor: number;
  refundsMinor: number;
  passThroughMinor: number;
  disposalMinor: number;
  processorMinor: number;
  contingencyMinor: number;
  driverMinor: number;
  minimumMarginMinor: number;
};
export function economics(input: EconomicsInput) {
  if (
    Object.values(input).some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    )
  )
    throw Error("All financial amounts must be nonnegative integer pence");
  const netMinor = input.totalMinor - input.vatMinor - input.refundsMinor;
  const eligibleMinor = netMinor - input.passThroughMinor;
  const marginMinor =
    netMinor -
    input.disposalMinor -
    input.processorMinor -
    input.contingencyMinor -
    input.driverMinor -
    input.passThroughMinor;
  return {
    netMinor,
    eligibleMinor,
    marginMinor,
    passes: eligibleMinor >= 0 && marginMinor >= input.minimumMarginMinor,
  };
}
export function availableForJob(
  driver: {
    availableDays: number[];
    availableFrom?: string | null;
    availableUntil?: string | null;
    coveragePrefixes: string[];
    capacityKg?: number | null;
    capacityM3?: number | null;
    wasteTypes: string[];
  },
  job: {
    scheduledAt?: Date | null;
    postcode?: string | null;
    expectedWeightKg?: number | null;
    expectedVolumeM3?: number | null;
    wasteType?: string | null;
  },
) {
  if (
    !job.scheduledAt ||
    !job.postcode ||
    !job.expectedWeightKg ||
    !job.expectedVolumeM3 ||
    !job.wasteType
  )
    return false;
  const date = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(job.scheduledAt);
  const part = (type: string) =>
    date.find((item) => item.type === type)?.value ?? "";
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    part("weekday"),
  );
  const time = `${part("hour")}:${part("minute")}`;
  const outward = job.postcode.toUpperCase().replace(/\s/g, "").slice(0, -3);
  return (
    driver.availableDays.includes(day) &&
    time >= (driver.availableFrom ?? "99:99") &&
    time < (driver.availableUntil ?? "00:00") &&
    driver.coveragePrefixes.includes(outward) &&
    (driver.capacityKg ?? 0) >= job.expectedWeightKg &&
    (driver.capacityM3 ?? 0) >= job.expectedVolumeM3 &&
    driver.wasteTypes.includes(job.wasteType)
  );
}
