"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/operations/client";
import { PhoneInput } from "./phone-input";
export function ProfileForm({ name, phone }: { name: string; phone: string }) {
  const [value, setValue] = useState(phone),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <form
      className="platform-form mt-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        const data = new FormData(event.currentTarget);
        try {
          await api(
            "/api/account/profile",
            { name: data.get("name"), phone: value },
            "PATCH",
          );
          setMessage("Profile updated.");
          router.refresh();
        } catch (error) {
          setMessage(error instanceof Error ? error.message : "Unable to save");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        Full name
        <input
          className="input"
          name="name"
          defaultValue={name}
          required
          minLength={2}
          maxLength={100}
        />
      </label>
      <label htmlFor="profile-phone">Phone number</label>
      <PhoneInput id="profile-phone" value={value} onValueChange={setValue} />
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
