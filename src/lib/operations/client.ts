export async function api<T>(
  url: string,
  body?: unknown,
  method = "POST",
): Promise<T> {
  const response = await fetch(
    url,
    body === undefined
      ? { cache: "no-store" }
      : {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "Request failed");
  return data as T;
}
export type PrivateUpload = {
  assetId: string;
  publicId: string;
  secureUrl: string;
};
export async function uploadPrivate(file: File, purpose: string) {
  const body = new FormData();
  body.set("file", file);
  body.set("purpose", purpose);
  const response = await fetch("/api/uploads", { method: "POST", body });
  const data = await response.json();
  if (!response.ok) throw Error(data.error ?? "Upload failed");
  return data as PrivateUpload;
}
export function moneyInput(value: FormDataEntryValue | null) {
  const input = String(value ?? "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(input))
    throw Error("Use a nonnegative GBP amount with at most two decimal places");
  return Math.round(Number(input) * 100);
}
export function localDate(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString("en-GB", {
        timeZone: "Europe/London",
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not scheduled";
}
