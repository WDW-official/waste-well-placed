"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/operations/client";
import { PrivateFileInput } from "@/components/private-file-input";
import { DriverEmailAccess } from "./driver-email-access";
type Application = {
  status: string;
  version: number;
  draft?: Record<string, unknown>;
  reviewNotes?: string;
};
const stages = [
  "About you",
  "Driving entitlement",
  "Your vehicle",
  "Waste authorisation",
  "Availability",
  "Documents",
  "Review & consent",
];
const fields: { key: string; label: string; type?: string; help?: string }[][] =
  [
    [
      { key: "legalName", label: "Full legal name" },
      { key: "dateOfBirth", label: "Date of birth", type: "date" },
      { key: "phone", label: "UK phone", type: "tel" },
      { key: "postcode", label: "Residential postcode" },
      { key: "basedIn", label: "Where are you based? (town or city)" },
    ],
    [
      { key: "licenceCountry", label: "Licence issuing country" },
      {
        key: "licenceCategories",
        label: "Licence categories (comma separated)",
        help: "For example B, C1",
      },
      { key: "yearsHeld", label: "Years licence held", type: "number" },
      { key: "licenceExpiresAt", label: "Licence expiry", type: "date" },
      { key: "points", label: "Valid licence points", type: "number" },
      { key: "endorsements", label: "Endorsements / restrictions (or None)" },
      {
        key: "licenceLastEight",
        label: "Last eight licence characters",
        help: "Encrypted on submission. Re-enter after returning to a saved application.",
      },
      {
        key: "dvlaCheckCode",
        label: "Consented DVLA check code",
        help: "The team uses this for an authorised check. There is no automatic DVLA approval.",
      },
    ],
    [
      { key: "vehicleRegistration", label: "Vehicle registration" },
      {
        key: "vehicleMakeModel",
        label: "What van do you own? (make and model)",
      },
      { key: "vanSize", label: "What size is your van?" },
      { key: "vehicleClass", label: "Vehicle class" },
      {
        key: "maximumWeightKg",
        label: "Maximum permitted weight (kg)",
        type: "number",
      },
      {
        key: "capacityKg",
        label: "Permitted load capacity (kg)",
        type: "number",
      },
      { key: "capacityM3", label: "Load volume (m³)", type: "number" },
      { key: "insuranceExpiresAt", label: "Insurance expiry", type: "date" },
      {
        key: "motExpiresAt",
        label: "MOT / roadworthiness review expiry",
        type: "date",
      },
    ],
    [
      {
        key: "carrierReference",
        label: "Carrier registration / authorisation reference",
      },
      {
        key: "carrierRelationship",
        label: "Operating company / carrier relationship",
      },
      {
        key: "carrierExpiresAt",
        label: "Authorisation recheck date",
        type: "date",
      },
      {
        key: "wasteTypes",
        label: "Waste types (comma separated)",
        help: "mixed, furniture, garden, construction, appliances",
      },
    ],
    [
      {
        key: "coveragePrefixes",
        label: "Preferred outward postcodes",
        help: "For example SW1A, E1, N1. Separate with commas.",
      },
      {
        key: "availableDays",
        label: "Available days",
        help: "Comma-separated numbers: Sunday 0, Monday 1, through Saturday 6.",
      },
      {
        key: "availableFrom",
        label: "Usual start time (London time)",
        type: "time",
      },
      {
        key: "availableUntil",
        label: "Usual end time (London time)",
        type: "time",
      },
    ],
  ];
const documentKinds = [
  "identity",
  "licence",
  "insurance",
  "carrier",
  "vehicle_front",
  "vehicle_side",
  "vehicle_load",
  "mot",
];
export function DriverApplicationForm({
  passwordPending = false,
}: {
  passwordPending?: boolean;
}) {
  const [application, setApplication] = useState<Application | null>(null);
  const [values, setValues] = useState<Record<string, string>>({
    licenceCountry: "United Kingdom",
    points: "0",
    endorsements: "None",
    workModel: "own_vehicle",
    availableDays: "1,2,3,4,5",
    availableFrom: "08:00",
    availableUntil: "18:00",
    wasteTypes: "mixed",
  });
  const [documents, setDocuments] = useState<Record<string, string[]>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    try {
      const result = await api<{ application: Application }>(
        "/api/driver/application",
      );
      setApplication(result.application);
      if (result.application?.draft) {
        const draft = result.application.draft;
        setValues((current) => ({
          ...current,
          ...Object.fromEntries(
            Object.entries(draft)
              .filter(
                ([key]) =>
                  ![
                    "documents",
                    "consents",
                    "disqualified",
                    "vehicleTaxConfirmed",
                  ].includes(key),
              )
              .map(([key, value]) => [
                key,
                Array.isArray(value) ? value.join(",") : String(value ?? ""),
              ]),
          ),
        }));
        setChecks({
          disqualified: draft.disqualified === true,
          vehicleTaxConfirmed: draft.vehicleTaxConfirmed === true,
          ...(draft.consents as Record<string, boolean>),
        });
        const stored = (draft.documents ?? []) as {
          kind: string;
          assetId: string;
        }[];
        setDocuments(
          Object.fromEntries(
            documentKinds.map((kind) => [
              kind,
              stored
                .filter((document) => document.kind === kind)
                .map((document) => document.assetId),
            ]),
          ),
        );
      }
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Application unavailable",
      );
    }
  }
  useEffect(() => {
    void load();
  }, []);
  function payload() {
    const result: Record<string, unknown> = {
      ...values,
      consents: {
        privacy: !!checks.privacy,
        checks: !!checks.checks,
        safety: !!checks.safety,
        contract: !!checks.contract,
      },
      hasFullUkLicence: values.hasFullUkLicence === "true",
      ownsVan: values.ownsVan === "true",
      workModel: values.ownsVan === "true" ? "own_vehicle" : "company_vehicle",
      disqualified: !!checks.disqualified,
      vehicleTaxConfirmed: !!checks.vehicleTaxConfirmed,
    };
    for (const key of [
      "yearsHeld",
      "points",
      "maximumWeightKg",
      "capacityKg",
      "capacityM3",
    ])
      result[key] = Number(values[key] ?? 0);
    for (const key of ["licenceCategories", "coveragePrefixes", "wasteTypes"])
      result[key] = (values[key] ?? "")
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
    result.availableDays = (values.availableDays ?? "")
      .split(",")
      .filter(Boolean)
      .map(Number);
    if (values.ownsVan !== "true") {
      for (const key of [
        "vanSize",
        "vehicleRegistration",
        "vehicleMakeModel",
        "vehicleClass",
        "maximumWeightKg",
        "capacityKg",
        "capacityM3",
        "insuranceExpiresAt",
        "motExpiresAt",
        "vehicleTaxConfirmed",
      ])
        delete result[key];
    }
    result.documents = Object.entries(documents)
      .filter(
        ([kind]) =>
          values.ownsVan === "true" ||
          ["identity", "licence", "carrier"].includes(kind),
      )
      .flatMap(([kind, ids]) => ids.map((assetId) => ({ kind, assetId })));
    return result;
  }
  async function save(action: "draft" | "submit") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await api("/api/driver/application", {
        action,
        version: application?.version ?? 0,
        data: payload(),
      });
      setMessage(
        action === "draft"
          ? "Progress saved. Sensitive licence codes are not saved in drafts."
          : "Submitted for human review. You cannot access paid jobs until approved.",
      );
      await load();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to save");
    } finally {
      setBusy(false);
    }
  }
  if (
    application &&
    !["draft", "more_information"].includes(application.status)
  )
    return (
      <div className="platform-card">
        <h2>Application: {application.status.replaceAll("_", " ")}</h2>
        <p>
          {application.reviewNotes ||
            "Our team will review your application and documents."}
        </p>
        {passwordPending ? (
          <>
            <p className="mt-4">
              {application.status === "active"
                ? "Your application is approved. Check your email for a secure link to set your password."
                : "We’ll email you when your application has been reviewed. You do not need a password yet."}
            </p>
            {application.status === "active" && <DriverEmailAccess />}
          </>
        ) : (
          <Link className="btn btn-primary mt-4" href="/driver">
            Go to driver workspace
          </Link>
        )}
      </div>
    );
  return (
    <form
      className="platform-card platform-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (step === 1 && values.hasFullUkLicence !== "true") {
          setError("You’re not eligible without a full UK driving licence.");
          return;
        }
        if (step === 2 && !["true", "false"].includes(values.ownsVan)) {
          setError("Tell us whether you own a van.");
          return;
        }
        setError("");
        if (step < stages.length - 1) setStep(step + 1);
        else void save("submit");
      }}
    >
      <div className="platform-progress" aria-label="Application progress">
        {stages.map((title, index) => (
          <span key={title} aria-current={step === index ? "step" : undefined}>
            {index + 1}. {title}
          </span>
        ))}
      </div>
      <h2>{stages[step]}</h2>
      {application?.reviewNotes && (
        <p className="platform-notice">{application.reviewNotes}</p>
      )}
      {(step === 1 || step === 2) && (
        <fieldset>
          <legend className="font-bold mb-3">
            {step === 1
              ? "Do you have a full UK driving licence?"
              : "Do you own a van?"}
          </legend>
          <div className="flex flex-wrap gap-5">
            {["true", "false"].map((answer) => (
              <label className="platform-checkbox" key={answer}>
                <input
                  type="radio"
                  name={step === 1 ? "hasFullUkLicence" : "ownsVan"}
                  required
                  checked={
                    values[step === 1 ? "hasFullUkLicence" : "ownsVan"] ===
                    answer
                  }
                  onChange={() =>
                    setValues((current) => ({
                      ...current,
                      [step === 1 ? "hasFullUkLicence" : "ownsVan"]: answer,
                    }))
                  }
                />
                {answer === "true" ? "Yes" : "No"}
              </label>
            ))}
          </div>
          {step === 1 && values.hasFullUkLicence === "false" && (
            <p className="platform-notice" role="status">
              You’re not eligible to apply without a full UK driving licence.
            </p>
          )}
          {step === 2 && values.ownsVan === "false" && (
            <p className="muted">
              Company-vehicle work is subject to availability. Our team must
              confirm vehicle, insurance and roadworthiness requirements before
              activation.
            </p>
          )}
        </fieldset>
      )}
      <div className="platform-form-grid">
        {((step === 1 && values.hasFullUkLicence !== "true") ||
        (step === 2 && values.ownsVan !== "true")
          ? []
          : (fields[step] ?? [])
        ).map((field) => (
          <label key={field.key}>
            {field.label}
            <input
              className="input"
              type={field.type ?? "text"}
              min={field.type === "number" ? 0 : undefined}
              step={field.type === "number" ? "any" : undefined}
              required
              maxLength={field.key === "licenceLastEight" ? 8 : 1000}
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues({ ...values, [field.key]: event.target.value })
              }
            />
            {field.help && <small>{field.help}</small>}
          </label>
        ))}
      </div>
      {step === 1 && (
        <label className="platform-checkbox">
          <input
            type="checkbox"
            checked={!!checks.disqualified}
            onChange={(event) =>
              setChecks({ ...checks, disqualified: event.target.checked })
            }
          />
          I currently have a driving disqualification
        </label>
      )}
      {step === 2 && values.ownsVan === "true" && (
        <label className="platform-checkbox">
          <input
            type="checkbox"
            required
            checked={!!checks.vehicleTaxConfirmed}
            onChange={(event) =>
              setChecks({
                ...checks,
                vehicleTaxConfirmed: event.target.checked,
              })
            }
          />
          I confirm current vehicle tax and appropriate insured business/waste
          use
        </label>
      )}
      {step === 4 && (
        <p className="muted">
          Work model:{" "}
          {values.ownsVan === "true"
            ? "Your own van"
            : "Company vehicle, subject to availability and review"}
          .
        </p>
      )}
      {step === 5 && (
        <>
          <p>
            Upload readable JPEG, PNG, WebP or PDF files up to 3 MB. Documents
            are private. Vehicle photographs should show the actual vehicle.
          </p>
          <div className="platform-form-grid">
            {documentKinds
              .filter(
                (kind) =>
                  values.ownsVan === "true" ||
                  ["identity", "licence", "carrier"].includes(kind),
              )
              .map((kind) => (
                <PrivateFileInput
                  key={kind}
                  label={kind.replaceAll("_", " ")}
                  purpose="driver_document"
                  value={documents[kind] ?? []}
                  onChange={(ids) =>
                    setDocuments((current) => ({ ...current, [kind]: ids }))
                  }
                />
              ))}
          </div>
        </>
      )}
      {step === 6 && (
        <>
          <p>
            Company eligibility currently starts at age 21 and no more than six
            valid points, subject to confirmed insurance and operating policy.
            Submission does not guarantee work or earnings.
          </p>
          {[
            [
              "privacy",
              "I have read the privacy information and consent to application review",
            ],
            [
              "checks",
              "I authorise the driving, identity, vehicle and authorisation checks described",
            ],
            [
              "safety",
              "I acknowledge PPE, safe working and service expectations",
            ],
            [
              "contract",
              "I acknowledge that work arrangements and contract terms require review before activation",
            ],
          ].map(([key, label]) => (
            <label className="platform-checkbox" key={key}>
              <input
                type="checkbox"
                required
                checked={!!checks[key]}
                onChange={(event) =>
                  setChecks({ ...checks, [key]: event.target.checked })
                }
              />
              {label}
            </label>
          ))}
          <Link href="/privacy" className="underline">
            Read privacy information
          </Link>
          <p className="muted">
            Licence check codes are omitted from saved drafts. If you returned
            to a saved application, re-enter them in Driving entitlement before
            submitting.
          </p>
        </>
      )}
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      <div className="platform-actions">
        {step > 0 && (
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setStep(step - 1)}
          >
            Previous
          </button>
        )}
        <button
          type="button"
          className="btn btn-outline"
          disabled={busy || !application}
          onClick={() => void save("draft")}
        >
          Save progress
        </button>
        <button
          className="btn btn-primary"
          disabled={
            busy ||
            !application ||
            (step === 1 && values.hasFullUkLicence !== "true")
          }
        >
          {busy
            ? "Saving…"
            : step === stages.length - 1
              ? "Submit for review"
              : "Continue"}
        </button>
      </div>
    </form>
  );
}
