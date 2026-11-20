"use client";
import { useState } from "react";
import { api } from "@/lib/operations/client";
import { Select } from "./select";
export function ReviewForm({ bookingId }: { bookingId: string }) {
  const [rating, setRating] = useState("5"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  return (
    <form
      className="card p-7 platform-form mt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const form = new FormData(event.currentTarget);
        try {
          await api("/api/reviews", {
            bookingId,
            name: form.get("name"),
            rating: Number(rating),
            text: form.get("text"),
            consent: form.get("consent") === "on",
          });
          setMessage("Thank you. Your review has been sent for moderation.");
        } catch (error) {
          setMessage(
            error instanceof Error ? error.message : "Unable to submit",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">Review your collection</h2>
      <label>
        Public display name
        <input className="input" name="name" required maxLength={80} />
      </label>
      <label>
        Rating
        <Select
          value={rating}
          onValueChange={setRating}
          options={[5, 4, 3, 2, 1].map((value) => ({
            value: String(value),
            label: `${value} out of 5`,
          }))}
        />
      </label>
      <label>
        Your review
        <textarea
          className="input"
          name="text"
          required
          minLength={10}
          maxLength={2000}
        />
      </label>
      <label className="platform-checkbox">
        <input type="checkbox" name="consent" required />I agree that my display
        name and review may be published after moderation.
      </label>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Submitting…" : "Submit review"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
