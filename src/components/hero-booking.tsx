"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Trash2,
  Armchair,
  Camera,
  MapPin,
  CalendarDays,
  ArrowRight,
  Check,
} from "lucide-react";
import { toast } from "sonner";

const tabs = [
  {
    key: "load",
    name: "Pile of junk",
    Icon: Trash2,
    description:
      "Bags, boxes and mixed rubbish. Choose the load size that fits.",
    action: "See load sizes",
  },
  {
    key: "items",
    name: "Single items",
    Icon: Armchair,
    description: "A sofa, a fridge, or a few things. Tell us what needs to go.",
    action: "Choose your items",
  },
  {
    key: "photo-quote",
    name: "Photo quote",
    Icon: Camera,
    description:
      "Not sure how much you have? Send a few photos and we’ll help.",
    action: "Get a photo quote",
  },
];

export function HeroBooking() {
  const [tab, setTab] = useState("load");
  const [postcode, setPostcode] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const active = tabs.find((item) => item.key === tab)!;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        `/api/postcodes/lookup?postcode=${encodeURIComponent(postcode.trim())}`,
      );
      const location = await response.json();
      if (!response.ok)
        throw new Error(location.error || "Unable to check postcode");
      setPostcode(location.postcode);
      sessionStorage.setItem(
        "wwp_booking_start",
        JSON.stringify({ postcode: location.postcode, date }),
      );
      router.push(`/book/${tab}`);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to check postcode. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="booking-widget">
      <div className="booking-tabs" aria-label="Choose collection type">
        {tabs.map(({ key, name, Icon }) => (
          <button
            key={key}
            type="button"
            aria-pressed={tab === key}
            disabled={busy}
            onClick={() => setTab(key)}
          >
            <span className="booking-tab-art">
              <Icon size={30} strokeWidth={1.6} />
            </span>
            <span>{name}</span>
          </button>
        ))}
      </div>
      <form className="booking-panel" onSubmit={submit}>
        <p key={tab} className="booking-description">
          {active.description}
        </p>
        <div className="booking-fields">
          <div className="input-with-icon">
            <MapPin aria-hidden="true" />
            <input
              id="hero-postcode"
              aria-label="UK postcode"
              required
              autoComplete="postal-code"
              className="input"
              disabled={busy}
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              placeholder="Enter your UK postcode"
              maxLength={10}
            />
          </div>
          <div className="booking-date">
            <CalendarDays aria-hidden="true" />
            <div>
              <label htmlFor="hero-date">When do you need it?</label>
              <select
                id="hero-date"
                disabled={busy}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              >
                <option value="">As soon as possible</option>
                {[
                  { days: 1, title: "Tomorrow" },
                  { days: 3, title: "In the next few days" },
                  { days: 7, title: "In a week or more" },
                ].map(({ days, title }) => {
                  const day = new Date();
                  day.setDate(day.getDate() + days);
                  return (
                    <option key={days} value={day.toLocaleDateString("en-CA")}>
                      {title}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary booking-submit"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Checking postcode…" : active.action}
            <ArrowRight size={19} />
          </button>
        </div>
        <p className="booking-reassurance">
          <Check size={15} /> No payment until the final step <span>·</span>{" "}
          Coverage checked before booking
        </p>
      </form>
    </div>
  );
}
