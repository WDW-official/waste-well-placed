"use client";
import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { request } from "@/lib/booking-client";
export function CrewUpdate({ id, status }: { id: string; status: string }) {
  const [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [waste, setWaste] = useState(""),
    [photo, setPhoto] = useState(""),
    [ewc, setEwc] = useState(""),
    [weight, setWeight] = useState("");
  const router = useRouter();
  const next = (
    {
      assigned: "en_route",
      en_route: "arrived",
      arrived: "completed",
    } as Record<string, string>
  )[status];
  if (!next) return null;
  async function submit() {
    setBusy(true);
    try {
      await request(
        `/api/crew/jobs/${id}`,
        {
          status: next,
          note,
          ...(next === "completed"
            ? {
                evidence: {
                  before: [],
                  after: [photo],
                  wasteDescription: waste,
                  ewcCode: ewc,
                  weightKg: weight ? Number(weight) : undefined,
                },
              }
            : {}),
        },
        "PATCH",
      );
      toast.success("Job status updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="card p-6 mt-6">
      <h2 className="font-bold text-xl mb-4">Update job</h2>
      <label className="label" htmlFor="jobnote">
        Collection notes
      </label>
      <textarea
        id="jobnote"
        className="input min-h-24"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      {next === "completed" && (
        <div className="space-y-4 mt-4">
          <div>
            <label className="label" htmlFor="waste">
              Waste description
            </label>
            <input
              id="waste"
              className="input"
              value={waste}
              onChange={(e) => setWaste(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="photo">
              After photo URL (Cloudinary)
            </label>
            <input
              id="photo"
              className="input"
              type="url"
              value={photo}
              onChange={(e) => setPhoto(e.target.value)}
            />
            <p className="text-xs muted mt-1">
              Completion requires a valid uploaded photo URL.
            </p>
          </div>
          <div>
            <label className="label" htmlFor="ewc">
              EWC code
            </label>
            <input
              id="ewc"
              className="input"
              value={ewc}
              onChange={(e) => setEwc(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="weight">
              Weight (kg)
            </label>
            <input
              id="weight"
              className="input"
              type="number"
              min="0"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
            />
          </div>
        </div>
      )}
      <button
        className="btn btn-primary mt-5"
        disabled={busy || (next === "completed" && (!photo || !waste))}
        onClick={submit}
      >
        {busy ? "Saving…" : `Mark ${next.replaceAll("_", " ")}`}
      </button>
    </div>
  );
}
