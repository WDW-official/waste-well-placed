"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Home,
  Building2,
  Camera,
  Check,
  Plus,
  ChevronDown,
  LockKeyhole,
  X,
  Leaf,
  LoaderCircle,
} from "lucide-react";
import { request, loadDraft } from "@/lib/booking-client";
import { Select } from "@/components/select";
import { toast } from "sonner";

type Photo = { publicId: string; secureUrl: string };
const timings = [
  { value: "asap", label: "ASAP" },
  { value: "next-few-days", label: "Next few days" },
  { value: "week-plus", label: "1 week+" },
  { value: "not-sure", label: "Not sure yet" },
];

export default function PhotoQuote() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    type: "home",
    line1: "",
    city: "",
    postcode: "",
    notes: "",
    consent: false,
    timing: "not-sure",
    propertyType: "",
    floor: "",
    parking: "",
  });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const uploadLock = useRef(false);
  const router = useRouter();

  useEffect(() => {
    const draft = loadDraft();
    setForm((current) => ({
      ...current,
      name: draft.contact?.name || "",
      email: draft.contact?.email || "",
      phone: draft.contact?.phone || "",
      type: draft.contact?.business ? "business" : "home",
      line1: draft.address?.line1 || "",
      city: draft.address?.city || "",
      postcode: draft.address?.postcode || draft.postcode || "",
    }));
    setPhotos(draft.photos || []);
  }, []);

  function update(key: keyof typeof form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function upload(files: FileList | null) {
    if (!files || uploadLock.current || busy) return;
    uploadLock.current = true;
    setUploading(true);
    setError("");
    const uploaded = [...photos];
    try {
      for (const file of Array.from(files)) {
        if (uploaded.length >= 8) {
          toast.error("You can add up to eight photos.");
          break;
        }
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 8_000_000
        ) {
          toast.error("Choose JPEG, PNG or WebP photos under 8 MB.");
          continue;
        }
        setProgress(`Uploading ${file.name}…`);
        const signed = await request<{
          timestamp: number;
          signature: string;
          apiKey: string;
          cloudName: string;
          folder: string;
        }>("/api/uploads/sign", { purpose: "quote" });
        const data = new FormData();
        data.append("file", file);
        for (const [key, value] of Object.entries({
          api_key: signed.apiKey,
          timestamp: String(signed.timestamp),
          signature: signed.signature,
          folder: signed.folder,
        }))
          data.append(key, value);
        const response = await fetch(
          `https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`,
          { method: "POST", body: data },
        );
        const photo = await response.json();
        if (!response.ok)
          throw new Error(
            photo.error?.message ||
              "Unable to upload this photo. Please try again.",
          );
        uploaded.push({
          publicId: photo.public_id,
          secureUrl: photo.secure_url,
        });
        setPhotos([...uploaded]);
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to upload photos. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setProgress("");
      setUploading(false);
      uploadLock.current = false;
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || uploadLock.current) return;
    setBusy(true);
    setError("");
    try {
      const response = await request<{ reference: string }>("/api/quotes", {
        kind: "photo",
        name: form.name,
        email: form.email,
        phone: form.phone,
        type: form.type,
        address: {
          line1: form.line1,
          city: form.city,
          postcode: form.postcode,
          notes: "",
        },
        notes: form.notes,
        timing: form.timing,
        collectionDetails: {
          propertyType: form.propertyType || undefined,
          floor: form.floor,
          parking: form.parking,
        },
        photos,
        consent: form.consent,
      });
      toast.success("Your quote request is on its way.");
      router.push(
        `/book/quote-received?ref=${encodeURIComponent(response.reference)}`,
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Unable to submit your quote. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="quote-request-page">
      <div className="container quote-request-layout">
        <aside className="quote-request-intro">
          <h1>
            Get a quote<span>.</span>
          </h1>
          <p>
            Tell us what needs removing and we’ll get back to you with a price.
            Free, with no obligation to book.
          </p>
          <div className="quote-reassurance-card">
            <div className="quote-reassurance-brand">
              <span>
                <Leaf size={23} />
              </span>
              <strong>A fresh start, made simple.</strong>
            </div>
            <p>Thoughtful collection. Clear next steps.</p>
            <ul>
              {[
                "Free quote requests",
                "Photos welcome, never required",
                "No payment to send your enquiry",
              ].map((text) => (
                <li key={text}>
                  <span>
                    <Check size={15} strokeWidth={3} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <div className="quote-next-card">
            <h2>WHAT HAPPENS NEXT</h2>
            <ol>
              <li>
                <span>1</span>We review your details and photos.
              </li>
              <li>
                <span>2</span>Our team contacts you with a price.
              </li>
              <li>
                <span>3</span>You decide when you’re ready.
              </li>
            </ol>
          </div>
        </aside>
        <form
          className="quote-request-form"
          onSubmit={submit}
          onInvalidCapture={(event) => {
            const field = event.target;
            if (
              field instanceof HTMLElement &&
              field.closest(".request-optional-fields")
            ) {
              setDetailsOpen(true);
              requestAnimationFrame(() => field.focus());
            }
          }}
        >
          <fieldset disabled={busy} className="quote-request-fieldset">
            <section className="request-section">
              <h2>
                <span className="request-number">1</span>What needs removing?
              </h2>
              <div
                className="request-segment request-type"
                aria-label="Collection type"
              >
                {[
                  { value: "home", label: "Home", Icon: Home },
                  { value: "business", label: "Business", Icon: Building2 },
                ].map(({ value, label, Icon }) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={form.type === value}
                    onClick={() => update("type", value)}
                  >
                    <Icon size={20} />
                    {label}
                  </button>
                ))}
              </div>
              <label className="request-label" htmlFor="quote-load">
                What’s in the load?
              </label>
              <textarea
                className="input request-load"
                id="quote-load"
                required
                minLength={10}
                maxLength={3000}
                value={form.notes}
                onChange={(e) => update("notes", e.target.value)}
                placeholder="e.g. Clearing a 2-bed flat: sofa, wardrobe and about 10 bags"
              />
              <label
                className={`request-upload ${uploading || photos.length >= 8 ? "is-disabled" : ""}`}
                htmlFor="quote-photos"
              >
                <span>
                  {uploading ? (
                    <LoaderCircle size={23} className="upload-spinner" />
                  ) : (
                    <Camera size={23} />
                  )}
                </span>
                <div>
                  <strong>
                    {uploading ? "Adding your photos…" : "Add photos"}
                  </strong>
                  <p>Optional, but photos help us price it accurately</p>
                </div>
                <Plus size={20} className="request-upload-plus" />
              </label>
              <input
                className="sr-only"
                id="quote-photos"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={uploading || photos.length >= 8}
                onChange={(e) => {
                  void upload(e.target.files);
                  e.target.value = "";
                }}
              />
              {(uploading || photos.length > 0) && (
                <p className="request-upload-status" role="status">
                  {progress ||
                    `${photos.length} of 8 photos added. JPEG, PNG or WebP, up to 8 MB each.`}
                </p>
              )}
              {photos.length > 0 && (
                <div className="request-photo-grid">
                  {photos.map((photo, i) => (
                    <div key={photo.publicId}>
                      <Image
                        src={photo.secureUrl}
                        alt={`Waste photo ${i + 1}`}
                        width={150}
                        height={150}
                      />
                      <button
                        type="button"
                        aria-label={`Remove photo ${i + 1}`}
                        disabled={uploading}
                        onClick={() =>
                          setPhotos((current) =>
                            current.filter(
                              (item) => item.publicId !== photo.publicId,
                            ),
                          )
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
            <section className="request-section">
              <h2>
                <span className="request-number">2</span>When do you need it?
              </h2>
              <div
                className="request-segment request-timing"
                aria-label="Preferred collection timing"
              >
                {timings.map(({ value, label }) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={form.timing === value}
                    onClick={() => update("timing", value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section className="request-section request-collection">
              <h2>
                <button
                  type="button"
                  aria-expanded={detailsOpen}
                  aria-controls="optional-collection-details"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                >
                  <span className="request-number">3</span>
                  <span>About the collection</span>
                  <small>Optional</small>
                  <ChevronDown
                    size={20}
                    className={detailsOpen ? "is-open" : ""}
                  />
                </button>
              </h2>
              {!detailsOpen && (
                <button
                  className="request-details-prompt"
                  type="button"
                  aria-expanded={false}
                  aria-controls="optional-collection-details"
                  onClick={() => setDetailsOpen(true)}
                >
                  <div>
                    <strong>Add collection details</strong>
                    <span>
                      Address type, floor and parking. Helps us price it
                      accurately.
                    </span>
                  </div>
                  <Plus size={23} />
                </button>
              )}
              <div
                id="optional-collection-details"
                data-open={detailsOpen}
                aria-hidden={!detailsOpen}
                inert={!detailsOpen}
                className="request-optional-fields"
              >
                <div className="form-grid">
                  <div className="md:col-span-2">
                    <label className="request-label" htmlFor="quote-property">
                      Property type
                    </label>
                    <Select
                      id="quote-property"
                      value={form.propertyType}
                      onValueChange={(value) => update("propertyType", value)}
                      options={[
                        { value: "", label: "Select property type" },
                        { value: "house", label: "House" },
                        { value: "flat", label: "Flat / apartment" },
                        {
                          value: "office",
                          label: "Office / business premises",
                        },
                        { value: "other", label: "Other" },
                      ]}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="request-label" htmlFor="quote-street">
                      Collection address
                    </label>
                    <input
                      className="input"
                      id="quote-street"
                      autoComplete="street-address"
                      minLength={4}
                      maxLength={180}
                      placeholder="House number and street"
                      value={form.line1}
                      onChange={(e) => update("line1", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="request-label" htmlFor="quote-city">
                      Town / city
                    </label>
                    <input
                      className="input"
                      id="quote-city"
                      autoComplete="address-level2"
                      minLength={2}
                      maxLength={100}
                      value={form.city}
                      onChange={(e) => update("city", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="request-label" htmlFor="quote-postcode">
                      UK postcode
                    </label>
                    <input
                      className="input"
                      id="quote-postcode"
                      autoComplete="postal-code"
                      maxLength={10}
                      placeholder="e.g. SW1A 1AA"
                      value={form.postcode}
                      onChange={(e) => update("postcode", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="request-label" htmlFor="quote-floor">
                      Which floor?
                    </label>
                    <input
                      className="input"
                      id="quote-floor"
                      maxLength={80}
                      placeholder="e.g. Ground floor, or 2nd floor with lift"
                      value={form.floor}
                      onChange={(e) => update("floor", e.target.value)}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="request-label" htmlFor="quote-parking">
                      Parking or access notes
                    </label>
                    <textarea
                      className="input"
                      id="quote-parking"
                      maxLength={500}
                      placeholder="Anything that would help the collection team"
                      value={form.parking}
                      onChange={(e) => update("parking", e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </section>
            <section className="request-section request-contact">
              <h2>
                <span className="request-number">4</span>Where should we send
                the quote?
              </h2>
              <div className="request-contact-grid">
                <div>
                  <label className="request-label" htmlFor="quote-email">
                    Email
                  </label>
                  <input
                    className="input"
                    id="quote-email"
                    type="email"
                    required
                    maxLength={254}
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </div>
                <div>
                  <label className="request-label" htmlFor="quote-phone">
                    Phone
                  </label>
                  <div className="request-phone">
                    <span aria-hidden="true">🇬🇧</span>
                    <input
                      className="input"
                      id="quote-phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={8}
                      maxLength={30}
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <p className="request-contact-note">
                We’ll only call if we need to check something about your quote.
              </p>
            </section>
            <label className="request-consent">
              <input
                type="checkbox"
                required
                checked={form.consent}
                onChange={(e) => update("consent", e.target.checked)}
              />
              <span>
                I agree to be contacted about this quote and have read the{" "}
                <Link href="/privacy" target="_blank">
                  privacy information
                </Link>
                .
              </span>
            </label>
            {error && (
              <p className="field-error request-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary request-submit"
              disabled={busy || uploading}
            >
              {busy ? (
                <>
                  <LoaderCircle size={19} className="upload-spinner" />
                  Sending your request…
                </>
              ) : (
                "Get my free quote"
              )}
            </button>
            <p className="request-privacy">
              <LockKeyhole size={16} />
              Your details are used to handle your enquiry.
            </p>
          </fieldset>
        </form>
      </div>
    </div>
  );
}
