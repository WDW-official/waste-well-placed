import { getSession, isStaff } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { DashLayout } from "@/components/dash-layout";
import { CrewUpdate } from "@/components/crew-update";
import { notFound } from "next/navigation";
import mongoose from "mongoose";
export default async function Job({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const u = await getSession();
  if (!mongoose.isValidObjectId(id)) notFound();
  await connectDB();
  const job = await Booking.findById(id).lean();
  if (!job || (!isStaff(u!.role) && String(job.assignedCrewId) !== u?.id))
    notFound();
  return (
    <DashLayout
      type="Collection crew"
      title={job.reference ?? "Collection job"}
      links={[
        { name: "Current jobs", href: "/crew" },
        { name: "History", href: "/crew/history" },
      ]}
    >
      <div className="card p-7">
        <h2 className="font-bold text-xl">Collection location</h2>
        <p className="mt-3">
          {job.address?.line1}, {job.address?.city}, {job.address?.postcode}
        </p>
        <p className="mt-3">Access: {job.address?.notes || "No notes"}</p>
        <p className="mt-3 font-bold">
          Status: {job.status.replaceAll("_", " ")}
        </p>
        <a
          className="btn btn-outline mt-4"
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address?.line1 + " " + job.address?.postcode)}`}
          target="_blank"
          rel="noreferrer"
        >
          Open directions
        </a>
      </div>
      <CrewUpdate id={id} status={job.status} />
    </DashLayout>
  );
}
