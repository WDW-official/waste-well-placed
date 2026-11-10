"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { BookingShell } from "@/components/booking-shell";
import {
  loadDraft,
  saveDraft,
  request,
  type BookingDraft,
} from "@/lib/booking-client";
import { LOADS } from "@/lib/constants";
import { phoneHref, whatsappHref } from "@/lib/contact";
import {
  Camera,
  ChevronDown,
  Check,
  ArrowRight,
  Headphones,
  Phone,
  MessageCircle,
  MapPin,
  X,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

type Photo = { publicId: string; secureUrl: string };
const titles = [
  "Your contact details",
  "Collection address",
  "Anything that needs special handling?",
  "Can you provide a few photos?",
];
const emptyContact = {
  name: "",
  email: "",
  phone: "",
  business: false,
  whatsapp: false,
};

export default function Details() {
  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [step, setStep] = useState(0);
  const [complete, setComplete] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    const saved = loadDraft();
    setDraft({
      ...saved,
      contact: saved.contact || emptyContact,
      address: saved.address || {
        line1: "",
        city: "",
        postcode: saved.postcode || "",
        notes: "",
      },
    });
  }, []);
  function update(patch: Partial<BookingDraft>) {
    if (!draft) return;
    const next = {
      ...draft,
      ...patch,
      estimate: undefined,
      holdId: undefined,
      slotId: undefined,
    };
    setDraft(next);
    saveDraft(next);
  }
  function contact(key: string, value: string | boolean) {
    setComplete((done) => done.filter((i) => i !== 0));
    update({ contact: { ...(draft?.contact || emptyContact), [key]: value } });
  }
  function address(key: string, value: string) {
    setComplete((done) => done.filter((i) => i !== 1));
    update({
      address: {
        line1: "",
        city: "",
        postcode: "",
        notes: "",
        ...draft?.address,
        [key]: value,
      },
    });
  }
  function advance(event: React.FormEvent, index: number) {
    event.preventDefault();
    setComplete((done) => [...new Set([...done, index])]);
    setStep(index + 1);
    setError("");
  }

  async function upload(files: FileList | null) {
    if (!draft || !files || uploading) return;
    const nextPhotos = [...(draft.photos || [])];
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        if (nextPhotos.length >= 8) {
          toast.error("You can add up to eight photos.");
          break;
        }
        if (
          !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
          file.size > 8_000_000
        ) {
          toast.error("Use JPEG, PNG or WebP images under 8 MB.");
          continue;
        }
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
          throw new Error(photo.error?.message || "Photo upload failed");
        nextPhotos.push({
          publicId: photo.public_id,
          secureUrl: photo.secure_url,
        });
        update({ photos: [...nextPhotos] });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to upload photos. Please try again.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function next() {
    if (!draft) return;
    if (
      !contactValid ||
      !addressValid ||
      !complete.includes(0) ||
      !complete.includes(1)
    ) {
      setStep(!contactValid || !complete.includes(0) ? 0 : 1);
      return;
    }
    if (draft.kind === "load" && (!draft.selected || !draft.loadKey)) {
      toast.error("Please choose a load size first.");
      router.push("/book/load");
      return;
    }
    if (draft.kind === "items" && !draft.items?.length) {
      toast.error("Please add an item first.");
      router.push("/book/items");
      return;
    }
    if (draft.specialHandling) {
      router.push("/book/photo-quote");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const coverage = await request<{
        covered: boolean;
        location: { postcode: string };
      }>("/api/coverage/check", { postcode: draft.address!.postcode });
      if (!coverage.covered)
        throw new Error(
          "We can’t confirm coverage for this postcode yet. Contact our team for a personalised quote.",
        );
      const code = coverage.location.postcode;
      const body = {
        kind: draft.kind,
        postcode: code,
        stairs: draft.stairs,
        longCarry: draft.longCarry,
        specialHandling: draft.specialHandling,
        ...(draft.kind === "load"
          ? { loadKey: draft.loadKey }
          : { items: draft.items }),
      };
      const estimate = await request<{ estimate: BookingDraft["estimate"] }>(
        "/api/quotes/estimate",
        body,
      );
      saveDraft({
        ...draft,
        postcode: code,
        address: { ...draft.address!, postcode: code },
        estimate: estimate.estimate,
      });
      sessionStorage.setItem(
        "wwp_booking_start",
        JSON.stringify({ postcode: code, date: draft.date || "" }),
      );
      router.push("/book/schedule");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to check your collection";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  const c = draft?.contact || emptyContact;
  const selected = LOADS.find((load) => load.key === draft?.loadKey);
  const contactValid =
    c.name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email) &&
    c.phone.replace(/\D/g, "").length >= 8;
  const addressValid =
    (draft?.address?.line1.trim().length || 0) >= 4 &&
    (draft?.address?.city.trim().length || 0) >= 2 &&
    Boolean(draft?.address?.postcode.trim());
  return (
    <BookingShell
      step={1}
      title="Build your quote"
      desc="Just a few more details, and we’ll check your personalised price. Nothing to pay until the final step."
    >
      {!draft ? (
        <p className="muted" role="status">
          Getting your details ready…
        </p>
      ) : (
        <div className="quote-layout">
          <div className="quote-steps">
            {titles.map((title, index) => (
              <section
                className={`quote-step ${step === index ? "is-open" : ""} ${complete.includes(index) ? "is-done" : ""}`}
                key={title}
              >
                <h2>
                  <button
                    type="button"
                    className="quote-step-heading"
                    disabled={busy || uploading}
                    id={`step-heading-${index}`}
                    aria-expanded={step === index}
                    aria-controls={`quote-section-${index}`}
                    onClick={() => {
                      if (
                        index === 0 ||
                        index <= step ||
                        complete.includes(index) ||
                        complete.includes(index - 1)
                      )
                        setStep(step === index ? -1 : index);
                    }}
                  >
                    <span className="quote-step-number">
                      {complete.includes(index) ? (
                        <Check size={13} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span>{title}</span>
                    <ChevronDown size={18} />
                  </button>
                </h2>
                {step === index && (
                  <div
                    className="quote-step-body"
                    id={`quote-section-${index}`}
                    role="region"
                    aria-labelledby={`step-heading-${index}`}
                  >
                    {index === 0 && (
                      <form onSubmit={(event) => advance(event, 0)}>
                        <p className="quote-intro">
                          So we know who to contact about your collection.
                        </p>
                        <div className="quote-business-choice">
                          <span className="label">
                            Are you booking for a business?
                          </span>
                          <div className="quote-choice">
                            {[false, true].map((value) => (
                              <button
                                type="button"
                                key={String(value)}
                                aria-pressed={c.business === value}
                                onClick={() => contact("business", value)}
                              >
                                {value ? "Yes" : "No"}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="form-grid">
                          <div className="md:col-span-2">
                            <label className="label" htmlFor="quote-name">
                              Your name
                            </label>
                            <input
                              className="input"
                              id="quote-name"
                              autoComplete="name"
                              required
                              minLength={2}
                              maxLength={100}
                              value={c.name}
                              onChange={(e) => contact("name", e.target.value)}
                              placeholder="Full name"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="label" htmlFor="quote-email">
                              Email for your collection details
                            </label>
                            <input
                              className="input"
                              id="quote-email"
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={254}
                              value={c.email}
                              onChange={(e) => contact("email", e.target.value)}
                              placeholder="you@example.com"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="label" htmlFor="quote-phone">
                              Mobile, in case we have a question
                            </label>
                            <input
                              className="input"
                              id="quote-phone"
                              type="tel"
                              autoComplete="tel"
                              required
                              minLength={8}
                              maxLength={30}
                              value={c.phone}
                              onChange={(e) => contact("phone", e.target.value)}
                              placeholder="e.g. 07123 456789"
                            />
                          </div>
                        </div>
                        <p className="quote-step-description">
                          Your details are used to manage this booking. Read our{" "}
                          <Link href="/privacy" className="underline">
                            privacy information
                          </Link>
                          .
                        </p>
                        <button
                          className="btn btn-primary quote-next"
                          disabled={!contactValid}
                          type="submit"
                        >
                          Next
                          <ArrowRight size={18} />
                        </button>
                      </form>
                    )}
                    {index === 1 && (
                      <form onSubmit={(event) => advance(event, 1)}>
                        <p className="quote-intro">
                          Where are we making room? Add the full collection
                          address.
                        </p>
                        <div className="form-grid">
                          <div className="md:col-span-2">
                            <label className="label" htmlFor="line1">
                              Address line 1
                            </label>
                            <input
                              id="line1"
                              className="input"
                              required
                              minLength={4}
                              maxLength={180}
                              autoComplete="street-address"
                              value={draft.address?.line1 || ""}
                              onChange={(e) => address("line1", e.target.value)}
                              placeholder="House number and street"
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor="city">
                              Town / city
                            </label>
                            <input
                              id="city"
                              required
                              minLength={2}
                              maxLength={100}
                              className="input"
                              autoComplete="address-level2"
                              value={draft.address?.city || ""}
                              onChange={(e) => address("city", e.target.value)}
                              placeholder="Town or city"
                            />
                          </div>
                          <div>
                            <label className="label" htmlFor="postcode">
                              UK postcode
                            </label>
                            <input
                              id="postcode"
                              required
                              maxLength={10}
                              className="input"
                              autoComplete="postal-code"
                              value={draft.address?.postcode || ""}
                              onChange={(e) =>
                                address("postcode", e.target.value)
                              }
                              placeholder="SW1A 1AA"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="label" htmlFor="notes">
                              Anything we should know about access?{" "}
                              <span className="muted">(optional)</span>
                            </label>
                            <textarea
                              id="notes"
                              className="input min-h-24"
                              maxLength={500}
                              value={draft.address?.notes || ""}
                              onChange={(e) => address("notes", e.target.value)}
                              placeholder="A side gate, parking instructions, which floor…"
                            />
                          </div>
                        </div>
                        <button
                          className="btn btn-primary quote-next"
                          type="submit"
                          disabled={!addressValid}
                        >
                          Next
                          <ArrowRight size={18} />
                        </button>
                      </form>
                    )}
                    {index === 2 && (
                      <form onSubmit={(event) => advance(event, 2)}>
                        <p className="quote-intro">
                          A few little details help the collection run smoothly.
                        </p>
                        {[
                          {
                            key: "stairs",
                            label: "There are stairs to the collection",
                          },
                          {
                            key: "longCarry",
                            label: "There’s a long carry to the vehicle",
                          },
                          {
                            key: "specialHandling",
                            label: "My waste needs specialist handling",
                          },
                        ].map((item) => (
                          <label className="quote-checkbox" key={item.key}>
                            <input
                              type="checkbox"
                              checked={Boolean(
                                draft[item.key as keyof BookingDraft],
                              )}
                              onChange={(e) =>
                                update({ [item.key]: e.target.checked })
                              }
                            />
                            <span>{item.label}</span>
                          </label>
                        ))}
                        <p className="quote-step-description">
                          Hazardous materials, chemicals and restricted waste
                          need a separate assessment. Access extras may affect
                          your price.
                        </p>
                        {draft.specialHandling ? (
                          <Link
                            className="btn btn-dark quote-next"
                            href="/book/photo-quote"
                          >
                            Request a specialist assessment
                            <ArrowRight size={18} />
                          </Link>
                        ) : (
                          <button
                            type="submit"
                            className="btn btn-primary quote-next"
                          >
                            Next
                            <ArrowRight size={18} />
                          </button>
                        )}
                      </form>
                    )}
                    {index === 3 && (
                      <>
                        <p>
                          Optional, but helpful. A clear view of your waste
                          helps the team prepare.
                        </p>
                        <label
                          className="quote-upload"
                          htmlFor="collection-photos"
                        >
                          <Camera size={29} />
                          <strong>
                            {uploading
                              ? "Uploading your photos…"
                              : "Add your waste photos"}
                          </strong>
                          <span>
                            JPEG, PNG or WebP · Up to 8 images · 8 MB each
                          </span>
                        </label>
                        <input
                          id="collection-photos"
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          disabled={
                            uploading || (draft.photos?.length || 0) >= 8
                          }
                          onChange={(e) => {
                            void upload(e.target.files);
                            e.target.value = "";
                          }}
                        />
                        <div className="quote-photo-grid">
                          {draft.photos?.map((photo: Photo) => (
                            <div key={photo.publicId}>
                              <Image
                                src={photo.secureUrl}
                                alt="Your collection waste"
                                width={140}
                                height={140}
                              />
                              <button
                                type="button"
                                aria-label="Remove photo"
                                disabled={uploading}
                                onClick={() =>
                                  update({
                                    photos: draft.photos?.filter(
                                      (p) => p.publicId !== photo.publicId,
                                    ),
                                  })
                                }
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="quote-step-description">
                          For a large or unusual clearance,{" "}
                          <Link className="underline" href="/book/photo-quote">
                            request a photo quote
                          </Link>{" "}
                          before booking.
                        </p>
                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={busy || uploading}
                          onClick={next}
                        >
                          {busy
                            ? "Checking your price…"
                            : "Check price & collection times"}
                          <ArrowRight size={18} />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </section>
            ))}
            <div className="quote-pending">
              <Clock size={18} />
              <div>
                <strong>Collection date & time</strong>
                <span>
                  Choose an available slot after we check your postcode.
                </span>
              </div>
            </div>
            {error && (
              <p role="alert" className="field-error quote-error">
                {error}
              </p>
            )}
          </div>
          <aside className="quote-sidebar">
            <div className="quote-summary">
              <span>YOUR FRESH START</span>
              <h3>
                {draft.kind === "load"
                  ? selected?.title || "Choose a load size"
                  : "Your selected items"}
              </h3>
              {draft.kind === "load" && selected ? (
                <p>
                  {selected.volume} cubic yards · up to {selected.weight} kg
                  <br />
                  {selected.minutes} minutes loading
                </p>
              ) : (
                <p>
                  {draft.items?.reduce((total, item) => total + item.qty, 0) ||
                    0}{" "}
                  items ready for collection
                </p>
              )}
              {draft.postcode && (
                <div className="quote-summary-line">
                  <MapPin size={14} />
                  {draft.postcode.toUpperCase()}
                </div>
              )}
              <Link href={draft.kind === "load" ? "/book/load" : "/book/items"}>
                Change your selection
              </Link>
            </div>
            <div className="quote-help">
              <div className="quote-help-heading">
                <span>
                  <Headphones size={23} />
                </span>
                <div>
                  <h3>
                    Need a hand<span>?</span>
                  </h3>
                  <p>Let’s work it out together.</p>
                </div>
              </div>
              <div className="quote-help-actions">
                <a className="btn btn-dark" href={phoneHref}>
                  <Phone size={16} />
                  {phoneHref.startsWith("tel:") ? "Call us" : "Contact us"}
                </a>
                {whatsappHref.startsWith("https:") && (
                  <a className="btn btn-outline" href={whatsappHref}>
                    <MessageCircle size={16} />
                    WhatsApp
                  </a>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </BookingShell>
  );
}
