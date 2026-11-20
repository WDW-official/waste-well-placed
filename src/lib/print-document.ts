import { emailSafe } from "./notifications";
export function money(value: number) {
  return `GBP ${(value / 100).toFixed(2)}`;
}
export function printDocument(
  title: string,
  lines: string[],
  table?: { head: string[]; rows: string[][] },
) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${emailSafe(title)}</title><style>body{font:16px Arial,sans-serif;max-width:800px;margin:40px auto;padding:24px;color:#123b30}h1{font-size:28px}p{white-space:pre-line;line-height:1.5}table{border-collapse:collapse;width:100%;margin:24px 0}th,td{padding:12px;border-bottom:1px solid #ddd;text-align:left}@media print{body{margin:0}}</style></head><body><h1>${emailSafe(title)}</h1>${lines.map((line) => `<p>${emailSafe(line)}</p>`).join("")}${table ? `<table><thead><tr>${table.head.map((value) => `<th>${emailSafe(value)}</th>`).join("")}</tr></thead><tbody>${table.rows.map((row) => `<tr>${row.map((value) => `<td>${emailSafe(value)}</td>`).join("")}</tr>`).join("")}</tbody></table>` : ""}<p>Use your browser’s Print option to print or save as PDF.</p></body></html>`;
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
