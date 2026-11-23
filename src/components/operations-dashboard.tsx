"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api, localDate } from "@/lib/operations/client";
import { gbp } from "@/lib/utils";
import { AdminSkeleton } from "./admin-skeleton";
import {
  ArrowUpRight,
  ClipboardCheck,
  Camera,
  Users,
  UserRoundCheck,
} from "lucide-react";

const overviewCards = [
  {
    key: "quotes",
    label: "Photo quotes",
    action: "Review quotes",
    href: "/admin/quotes",
    Icon: Camera,
  },
  {
    key: "unassigned",
    label: "Awaiting a driver",
    action: "View collections",
    href: "/admin/jobs",
    Icon: UserRoundCheck,
  },
  {
    key: "driverApplications",
    label: "Driver applications",
    action: "Review applications",
    href: "/admin/drivers",
    Icon: Users,
  },
  {
    key: "evidence",
    label: "Evidence to review",
    action: "Check collections",
    href: "/admin/jobs?status=evidence_submitted",
    Icon: ClipboardCheck,
  },
];
type Row = {
  _id: string;
  reference?: string;
  legalName?: string;
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  company?: string;
  status?: string;
  event?: string;
  subject?: string;
  attempts?: number;
  href?: string;
  paymentStatus?: string;
  scheduledAt?: string;
  createdAt?: string;
  submittedAt?: string;
  expiresAt?: string;
  totalMinor?: number;
  offeredMinor?: number;
  customer?: { name?: string; email?: string; phone?: string };
  address?: { postcode?: string };
  price?: { totalMinor?: number };
  photos?: { secureUrl: string }[];
  assignmentId?: string;
  bookingId?: string;
  note?: string;
  dueAt?: string;
  permitReference?: string;
  active?: boolean;
};
export function OperationsDashboard({
  view = "jobs",
  showSummary = false,
}: {
  view?: string;
  showSummary?: boolean;
}) {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") ?? "";
  const [rows, setRows] = useState<Row[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  async function load(statusFilter = status) {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ rows: Row[]; counts: Record<string, number> }>(
        `/api/operations?view=${view}&q=${encodeURIComponent(q)}&status=${encodeURIComponent(statusFilter)}`,
      );
      setRows(data.rows);
      setCounts(data.counts);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to load");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setStatus(initialStatus);
    void load(initialStatus); /* Other filters are submitted explicitly. */ // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, initialStatus]);
  const link = (row: Row) =>
    view === "jobs"
      ? `/admin/jobs/${row._id}`
      : view === "quotes"
        ? `/admin/quotes/${row._id}`
        : view === "drivers"
          ? `/admin/drivers/${row._id}`
          : row.bookingId
            ? `/admin/jobs/${row.bookingId}`
            : undefined;
  return (
    <div className="platform-stack">
      {showSummary && loading ? (
        <AdminSkeleton variant="metrics" label="Loading overview" />
      ) : (
        showSummary &&
        !!Object.keys(counts).length && (
          <div
            className="platform-metrics admin-overview-metrics"
            aria-label="Collection operations summary"
          >
            {overviewCards.map(({ key, label, action, href, Icon }) => (
              <Link className="admin-overview-metric" key={key} href={href}>
                <div className="admin-metric-top">
                  <span>{label}</span>
                  <span className="admin-metric-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                </div>
                <strong className="admin-metric-value">
                  {counts[key] ?? 0}
                </strong>
                <div className="admin-metric-action">
                  <span>{action}</span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </div>
              </Link>
            ))}
          </div>
        )
      )}
      <form
        className="platform-filters"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input
          className="input"
          aria-label="Search reference, email or postcode"
          placeholder="Search reference, email or postcode"
          value={q}
          onChange={(event) => setQ(event.target.value)}
        />
        <input
          className="input"
          aria-label="Filter by status"
          placeholder="Status (e.g. confirmed)"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        />
        <button className="btn btn-primary">Search / refresh</button>
      </form>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {loading && <AdminSkeleton variant="cards" />}
      {!loading && !rows.length && !error && (
        <div className="platform-card">No records match this queue.</div>
      )}
      <div className="platform-record-grid">
        {!loading &&
          rows.map((row) => {
            const href = link(row);
            return (
              <article className="platform-card" key={row._id}>
                <div className="platform-card-heading">
                  <h2>
                    {href ? (
                      <Link href={href}>
                        {row.reference ??
                          row.legalName ??
                          row.name ??
                          row.subject ??
                          row._id.slice(-8)}
                      </Link>
                    ) : (
                      (row.name ??
                      row.subject ??
                      row.reference ??
                      row._id.slice(-8))
                    )}
                  </h2>
                  <span className="platform-badge">
                    {row.status ?? (row.active ? "approved" : "pending")}
                  </span>
                </div>
                {!!row.photos?.length && (
                  <div className="platform-photos">
                    {row.photos.slice(0, 3).map((photo) => (
                      <a
                        href={photo.secureUrl}
                        key={photo.secureUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.secureUrl} alt="Customer waste" />
                      </a>
                    ))}
                  </div>
                )}
                {row.customer && (
                  <p>
                    {row.customer.name} · {row.customer.email}
                    <br />
                    {row.customer.phone}
                  </p>
                )}
                {row.address?.postcode && <p>{row.address.postcode}</p>}
                {row.scheduledAt && <p>{localDate(row.scheduledAt)}</p>}
                {row.paymentStatus && (
                  <p>
                    Payment: {row.paymentStatus} ·{" "}
                    {gbp(row.price?.totalMinor ?? 0)}
                  </p>
                )}
                {row.totalMinor !== undefined && (
                  <p>Quote: {gbp(row.totalMinor)}</p>
                )}
                {row.offeredMinor !== undefined && (
                  <p>Original offer: {gbp(row.offeredMinor)}</p>
                )}
                {row.note && <p>{row.note}</p>}
                {row.message && <p>{row.message}</p>}
                {row.email && <a href={`mailto:${row.email}`}>{row.email}</a>}
                {row.phone && (
                  <p>
                    <a href={`tel:${row.phone}`}>{row.phone}</a>
                  </p>
                )}
                {row.permitReference && (
                  <p>
                    Permit: {row.permitReference}
                    <br />
                    Recheck: {localDate(row.expiresAt)}
                  </p>
                )}
                {row.event && (
                  <p>
                    {row.event} · {row.attempts ?? 0} delivery attempts
                  </p>
                )}
                {href && (
                  <Link className="btn btn-outline mt-4" href={href}>
                    Open record →
                  </Link>
                )}
              </article>
            );
          })}
      </div>
      <p className="muted">
        Queues show the first 100 matching records. Search or filter to narrow
        the list.
      </p>
    </div>
  );
}
