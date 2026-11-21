"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/operations/client";
import { Select } from "@/components/select";
import { DriverEmailAccess } from "./driver-email-access";

export function DriverAccess({ register = false }: { register?: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [licence, setLicence] = useState("");
  const [ownsVan, setOwnsVan] = useState("");
  const [vanSize, setVanSize] = useState("");
  return (
    <div className="platform-stack">
      <form
        className={`platform-card platform-form max-w-lg${register ? " driver-start-card" : ""}`}
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy || (register && (licence !== "yes" || !ownsVan))) return;
          setBusy(true);
          setError("");
          const form = new FormData(event.currentTarget);
          try {
            await api(`/api/driver/${register ? "register" : "login"}`, {
              ...Object.fromEntries(form),
              ...(register
                ? {
                    hasFullUkLicence: licence === "yes",
                    ownsVan: ownsVan === "yes",
                    ...(ownsVan === "yes" ? { vanSize } : {}),
                  }
                : {}),
            });
            router.push(register ? "/driver/apply" : "/driver");
            router.refresh();
          } catch (failure) {
            setError(
              failure instanceof Error ? failure.message : "Unable to continue",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {register && (
          <>
            <h2>Start your application</h2>
            <p>
              No password is needed to apply. If approved, we’ll email you a
              secure link to set one.
            </p>
            <fieldset>
              <legend className="font-bold mb-3">
                Do you have a full UK driving licence?
              </legend>
              <div className="flex flex-wrap gap-5">
                {["yes", "no"].map((answer) => (
                  <label className="platform-checkbox" key={answer}>
                    <input
                      type="radio"
                      name="licenceAnswer"
                      value={answer}
                      checked={licence === answer}
                      required
                      onChange={() => setLicence(answer)}
                    />
                    {answer === "yes" ? "Yes" : "No"}
                  </label>
                ))}
              </div>
            </fieldset>
            {licence === "no" && (
              <p className="platform-notice" role="status">
                You’re not eligible to apply without a full UK driving licence.
              </p>
            )}
          </>
        )}
        {(!register || licence === "yes") && (
          <>
            {register && (
              <>
                <label>
                  Full legal name
                  <input
                    className="input"
                    name="name"
                    required
                    maxLength={100}
                    autoComplete="name"
                  />
                </label>
                <label>
                  UK phone
                  <input
                    className="input"
                    name="phone"
                    type="tel"
                    required
                    minLength={8}
                    maxLength={30}
                    autoComplete="tel"
                  />
                </label>
                <label>
                  Where are you based?
                  <input
                    className="input"
                    name="basedIn"
                    required
                    minLength={2}
                    maxLength={100}
                    autoComplete="address-level2"
                    placeholder="Town or city"
                  />
                </label>
                <label>
                  Residential postcode
                  <input
                    className="input"
                    name="postcode"
                    required
                    maxLength={10}
                    autoComplete="postal-code"
                  />
                </label>
                <fieldset>
                  <legend className="font-bold mb-3">Do you own a van?</legend>
                  <div className="flex flex-wrap gap-5">
                    {["yes", "no"].map((answer) => (
                      <label className="platform-checkbox" key={answer}>
                        <input
                          type="radio"
                          name="vanAnswer"
                          value={answer}
                          checked={ownsVan === answer}
                          required
                          onChange={() => setOwnsVan(answer)}
                        />
                        {answer === "yes" ? "Yes" : "No"}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {ownsVan === "yes" && (
                  <>
                    <label>
                      What van do you own?
                      <input
                        className="input"
                        name="vehicleMakeModel"
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder="Make and model, e.g. Ford Transit"
                      />
                    </label>
                    <label>
                      What size is your van?
                      <Select
                        value={vanSize}
                        onValueChange={setVanSize}
                        options={[
                          {
                            value: "",
                            label: "Choose van size",
                            disabled: true,
                          },
                          ...[
                            "Small van",
                            "Medium van",
                            "Large van",
                            "Luton van",
                            "Other",
                          ].map((value) => ({ value, label: value })),
                        ]}
                      />
                    </label>
                  </>
                )}
                {ownsVan === "no" && (
                  <p className="muted">
                    You can still apply. Any company-vehicle work is subject to
                    availability and approval.
                  </p>
                )}
              </>
            )}
            <label>
              Email address
              <input
                className="input"
                name="email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </label>
            {!register && (
              <label>
                Password
                <input
                  className="input"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={120}
                />
              </label>
            )}
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <button
              className="btn btn-primary"
              disabled={
                busy ||
                (register && (!ownsVan || (ownsVan === "yes" && !vanSize)))
              }
            >
              {busy
                ? "Please wait…"
                : register
                  ? "Continue application"
                  : "Sign in as a driver"}
            </button>
          </>
        )}
        <p className={register ? "driver-start-signin" : undefined}>
          {register ? "Already applied?" : "New to the team?"}{" "}
          <Link
            className="underline"
            href={register ? "/driver/login" : "/driver/apply"}
          >
            {register ? "Sign in or request an access link" : "Apply to drive"}
          </Link>
        </p>
        {register && (
          <Link className="underline driver-start-privacy" href="/privacy">
            How we use your application details
          </Link>
        )}
      </form>
      {!register && (
        <>
          <Link href="/forgot-password" className="underline">
            Forgot your password?
          </Link>
          <DriverEmailAccess />
        </>
      )}
    </div>
  );
}
