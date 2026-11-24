"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminCreateRecord } from "./admin-create-record";
import { Eye, Pencil } from "lucide-react";
import {
  AdminRecordModal,
  adminFieldLabel,
  type AdminRow,
} from "./admin-record-modal";
import { AdminPage } from "./admin-page";
import { toast } from "sonner";
import { SkeletonBlock, TableRowsSkeleton } from "./admin-skeleton";
import { resourceFields } from "@/lib/admin-resource-fields";
import { gbp } from "@/lib/utils";
type Row = AdminRow;
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
  const [selection, setSelection] = useState<{
    row: Row;
    mode: "view" | "edit" | "price";
  } | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  const [editableFields, setEditableFields] = useState<string[]>([]);
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
        setCanCreate(j.canCreate === true);
        setEditableFields(j.editableFields ?? []);
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
  return (
    <AdminPage title={title}>
      {editable && editableFields.includes("priceMinor") && (
        <p className="muted text-sm mb-5">
          Prices are in pounds (£). Select a price to change it, or use Edit.
        </p>
      )}
      {canCreate ? (
        <AdminCreateRecord
          name={name}
          onCreated={async () => {
            if (page === 1) await load(1);
            else setPage(1);
          }}
        />
      ) : (
        loading && (
          <div className="mb-6">
            <SkeletonBlock className="skeleton-button" />
          </div>
        )
      )}
      <div className="flex items-center justify-between mb-5 gap-4">
        <input
          className="input max-w-md"
          placeholder={`Filter this page of ${name}…`}
          aria-label="Filter rows"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="muted text-sm">
          {loading ? (
            <SkeletonBlock className="skeleton-line" />
          ) : (
            `${count} records`
          )}
        </span>
      </div>
      <div className="table-wrap">
        {loading && (
          <span className="sr-only" role="status">
            Loading records…
          </span>
        )}
        <table className="data-table" aria-busy={loading}>
          <thead>
            <tr>
              {fields.map((f) => (
                <th key={f}>
                  {resourceFields[name]?.find((field) => field.key === f)
                    ?.label ?? adminFieldLabel(f)}
                </th>
              ))}
              <th className="admin-table-actions-heading">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <TableRowsSkeleton columns={fields.length + 1} />
            ) : (
              shown.map((r) => (
                <tr key={r._id}>
                  {fields.map((f) => (
                    <td
                      key={f}
                      className="max-w-64 truncate"
                      title={String(r[f] ?? "")}
                    >
                      {f === "priceMinor" &&
                      editable &&
                      editableFields.includes(f) ? (
                        <button
                          type="button"
                          className="admin-price-button"
                          title="Change price"
                          aria-label={`Change price for ${String(r.title ?? r.key ?? r._id)}`}
                          onClick={() =>
                            setSelection({ row: r, mode: "price" })
                          }
                        >
                          {gbp(Number(r[f] ?? 0))}
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                      ) : resourceFields[name]?.find((field) => field.key === f)
                          ?.type === "money" ? (
                        gbp(Number(r[f] ?? 0))
                      ) : typeof r[f] === "object" ? (
                        JSON.stringify(r[f])
                      ) : (
                        String(r[f] ?? "—")
                      )}
                    </td>
                  ))}
                  <td className="admin-table-actions-cell">
                    <div className="admin-table-actions">
                      <button
                        type="button"
                        onClick={() => setSelection({ row: r, mode: "view" })}
                      >
                        <Eye size={16} aria-hidden="true" />
                        View
                      </button>
                      {editable && editableFields.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelection({ row: r, mode: "edit" })}
                        >
                          <Pencil size={15} aria-hidden="true" />
                          Edit
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
            {!loading && !shown.length && (
              <tr>
                <td colSpan={fields.length + 1}>No results found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex gap-3 items-center mt-6">
        <button
          className="btn btn-outline"
          disabled={loading || page === 1}
          onClick={() => setPage((x) => Math.max(1, x - 1))}
        >
          Previous
        </button>
        <span>Page {page}</span>
        <button
          className="btn btn-outline"
          disabled={loading || page * 20 >= count}
          onClick={() => setPage((x) => x + 1)}
        >
          Next
        </button>
      </div>
      {selection && (
        <AdminRecordModal
          key={selection.row._id}
          name={name}
          title={title}
          row={selection.row}
          fields={fields}
          editableFields={editable ? editableFields : []}
          initialMode={selection.mode}
          onClose={() => setSelection(null)}
          onSaved={() => load()}
        />
      )}
    </AdminPage>
  );
}
