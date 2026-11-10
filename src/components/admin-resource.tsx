"use client";
import { useCallback, useEffect, useState } from "react";
import { Select } from "@/components/select";
import { DashLayout } from "@/components/dash-layout";
import { adminLinks } from "@/lib/admin-links";
import { toast } from "sonner";
import { request } from "@/lib/booking-client";
type Row = { _id: string; [key: string]: unknown };
export function AdminResource({
  title,
  name,
  fields,
  editable = false,
}: {
  title: string;
  name: string;
  fields: string[];
  editable?: boolean;
}) {
  const [rows, setRows] = useState<Row[]>([]),
    [loading, setLoading] = useState(true),
    [page, setPage] = useState(1),
    [count, setCount] = useState(0),
    [filter, setFilter] = useState("");
  const load = useCallback(
    async (p = page) => {
      setLoading(true);
      try {
        const r = await fetch(`/api/admin/collections?name=${name}&page=${p}`, {
          cache: "no-store",
        });
        const j = await r.json();
        if (!r.ok) throw Error(j.error);
        setRows(j.rows);
        setCount(j.count);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not load data");
      } finally {
        setLoading(false);
      }
    },
    [name, page],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const shown = rows.filter(
    (r) =>
      !filter || JSON.stringify(r).toLowerCase().includes(filter.toLowerCase()),
  );
  async function edit(row: Row, key: string) {
    const value = prompt(`New value for ${key}`, String(row[key] ?? ""));
    if (value === null) return;
    try {
      let parsed: unknown = value;
      if (value === "true") parsed = true;
      else if (value === "false") parsed = false;
      else if (value.trim() !== "" && !isNaN(Number(value)))
        parsed = Number(value);
      else if (value.startsWith("[") || value.startsWith("{"))
        parsed = JSON.parse(value);
      await request(
        "/api/admin/record",
        { name, id: row._id, patch: { [key]: parsed } },
        "PATCH",
      );
      toast.success("Updated");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  }
  return (
    <DashLayout type="Operations" title={title} links={adminLinks}>
      <div className="flex items-center justify-between mb-5 gap-4">
        <input
          className="input max-w-md"
          placeholder={`Filter this page of ${name}…`}
          aria-label="Filter rows"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="muted text-sm">{count} records</span>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f}>{f}</th>
              ))}
              {editable && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r._id}>
                {fields.map((f) => (
                  <td
                    key={f}
                    className="max-w-64 truncate"
                    title={String(r[f] ?? "")}
                  >
                    {typeof r[f] === "object"
                      ? JSON.stringify(r[f])
                      : String(r[f] ?? "—")}
                  </td>
                ))}
                {editable && (
                  <td>
                    <Select
                      aria-label="Select field to edit"
                      className="!min-h-9"
                      value=""
                      placeholder="Edit field…"
                      onValueChange={(field) => {
                        if (field) void edit(r, field);
                      }}
                      options={fields
                        .filter(
                          (field) =>
                            !field.startsWith("_") &&
                            !field.includes("password"),
                        )
                        .map((field) => ({ value: field, label: field }))}
                    />
                  </td>
                )}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={fields.length + Number(editable)}>
                  {loading ? "Loading…" : "No results found"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 items-center mt-6">
        <button
          className="btn btn-outline"
          disabled={page === 1}
          onClick={() => setPage((x) => Math.max(1, x - 1))}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn btn-outline"
          disabled={page * 20 >= count}
          onClick={() => setPage((x) => x + 1)}
        >
          Next
        </button>
      </div>
    </DashLayout>
  );
}
