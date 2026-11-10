"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BookingShell } from "@/components/booking-shell";
import {
  loadDraft,
  saveDraft,
  request,
  type BookingDraft,
} from "@/lib/booking-client";
import { gbp } from "@/lib/utils";
import { toast } from "sonner";
type Slot = { id: string; start: string; end: string; remaining: number };
export default function Schedule() {
  const [d, setD] = useState<BookingDraft | null>(null),
    [date, setDate] = useState(""),
    [slots, setSlots] = useState<Slot[]>([]),
    [chosen, setChosen] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const x = loadDraft();
    setD(x);
    setDate(x.date || new Date().toLocaleDateString("en-CA"));
  }, []);
  useEffect(() => {
    if (!date || !d?.postcode) return;
    let live = true;
    fetch(`/api/slots?postcode=${encodeURIComponent(d.postcode)}&date=${date}`)
      .then((r) => r.json())
      .then((v) => {
        if (live) {
          setSlots(v.slots || []);
          setError(v.error || "");
        }
      })
      .catch(() => {
        if (live) setError("Could not load available slots");
      });
    return () => {
      live = false;
    };
  }, [date, d?.postcode]);
  if (!d) return <div className="container section">Loading…</div>;
  async function proceed() {
    if (!d) return;
    if (!chosen) return toast.error("Choose an available time slot");
    setBusy(true);
    try {
      const result = await request<{ holdId: string }>("/api/slot-holds", {
        slotId: chosen,
      });
      const updated = { ...d, date, slotId: chosen, holdId: result.holdId };
      saveDraft(updated);
      router.push("/book/checkout");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Slot unavailable";
      if (message.includes("Log in")) {
        toast.error(
          "Sign in to reserve the selected slot, then choose your time again",
        );
        router.push("/login?next=%2Fbook%2Fschedule");
      } else toast.error(message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <BookingShell
      step={2}
      title="Choose a collection time"
      desc="Only available appointment slots can be reserved; a temporary hold expires after 15 minutes."
    >
      <div className="grid md:grid-cols-[1fr_300px] gap-6">
        <div className="card p-7">
          <label htmlFor="date" className="label">
            Collection date
          </label>
          <input
            className="input max-w-xs"
            id="date"
            type="date"
            min={new Date().toLocaleDateString("en-CA")}
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              setChosen("");
            }}
          />
          <h2 className="font-bold text-lg mt-7 mb-3">Available times</h2>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {slots.map((s) => (
              <button
                aria-pressed={chosen === s.id}
                onClick={() => setChosen(s.id)}
                key={s.id}
                className={`text-left p-5 rounded-xl border-2 ${chosen === s.id ? "border-green-600 bg-green-50" : "border-gray-200"}`}
              >
                <strong>
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/London",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(s.start))}{" "}
                  –{" "}
                  {new Intl.DateTimeFormat("en-GB", {
                    timeZone: "Europe/London",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(s.end))}
                </strong>
                <p className="text-sm muted mt-1">
                  {s.remaining} space{s.remaining !== 1 ? "s" : ""} available
                </p>
              </button>
            ))}
          </div>
          {!slots.length && !error && (
            <p className="muted">
              No slots are available for this date. Please select another day.
            </p>
          )}
        </div>
        <aside className="card p-6 h-fit">
          <h2 className="font-bold text-xl">Your estimated total</h2>
          <p className="heading text-green-900 mt-4">
            {d.estimate ? gbp(d.estimate.totalMinor) : "—"}
          </p>
          <p className="muted text-sm">
            Calculated from the current example tariffs. Revalidated by the
            server at booking.
          </p>
          <button
            className="btn btn-primary w-full mt-6"
            disabled={busy || !chosen}
            onClick={proceed}
          >
            {busy ? "Reserving…" : "Reserve slot"}
          </button>
        </aside>
      </div>
    </BookingShell>
  );
}
