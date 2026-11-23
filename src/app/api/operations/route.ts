import { z } from "zod";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { permitted, backoffice } from "@/lib/operations/policy";
import { connectDB } from "@/lib/db";
import { Booking, Quote, Enquiry } from "@/lib/models";
import {
  Assignment,
  DriverApplication,
  Facility,
  Issue,
  OperationsPolicy,
  Payout,
  Notification,
} from "@/lib/operations/models";
import { ok, errorResponse } from "@/lib/http";
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const view = z
      .enum([
        "jobs",
        "quotes",
        "drivers",
        "facilities",
        "payouts",
        "issues",
        "policy",
        "notifications",
        "enquiries",
      ])
      .parse(params.get("view") ?? "jobs");
    const permission =
      view === "drivers"
        ? "drivers"
        : view === "payouts"
          ? "finance"
          : view === "facilities"
            ? "verify"
            : view === "policy"
              ? "policy"
              : "operations";
    requireCondition(
      view === "jobs"
        ? backoffice(user.role)
        : permitted(user.role, permission),
      "Not permitted",
      403,
    );
    await connectDB();
    const search = (params.get("q") ?? "")
      .slice(0, 100)
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const status = params.get("status");
    let rows: unknown[] = [];
    if (view === "jobs")
      rows = await Booking.find({
        ...(search
          ? {
              $or: [
                { reference: new RegExp(search, "i") },
                { "address.postcode": new RegExp(search, "i") },
                { "contact.email": new RegExp(search, "i") },
              ],
            }
          : {}),
        ...(status ? { status } : {}),
      })
        .sort({ scheduledAt: 1, createdAt: -1 })
        .limit(100)
        .lean();
    if (view === "quotes")
      rows = await Quote.find({
        ...(search ? { reference: new RegExp(search, "i") } : {}),
        ...(status ? { status } : {}),
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    if (view === "drivers")
      rows = await DriverApplication.find({ ...(status ? { status } : {}) })
        .select("-draft -documents")
        .sort({ submittedAt: -1 })
        .limit(100)
        .lean();
    if (view === "facilities")
      rows = await Facility.find().sort({ name: 1 }).limit(100).lean();
    if (view === "payouts")
      rows = await Payout.find({ ...(status ? { status } : {}) })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    if (view === "issues")
      rows = await Issue.find({ ...(status ? { status } : {}) })
        .sort({ dueAt: 1 })
        .limit(100)
        .lean();
    if (view === "policy")
      rows = [
        await OperationsPolicy.findOne({ key: "operations" }).lean(),
      ].filter(Boolean);
    if (view === "notifications")
      rows = await Notification.find({ recipientId: user.id })
        .select("event subject message status attempts createdAt href")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
    if (view === "enquiries")
      rows = await Enquiry.find().sort({ createdAt: -1 }).limit(100).lean();
    const counts = permitted(user.role, "operations")
      ? {
          quotes: await Quote.countDocuments({
            status: { $in: ["new", "reviewing"] },
          }),
          unassigned: await Booking.countDocuments({
            paymentStatus: "paid",
            status: "confirmed",
            assignmentId: { $exists: false },
          }),
          active: await Assignment.countDocuments({ live: true }),
          driverApplications: await DriverApplication.countDocuments({
            status: {
              $in: [
                "submitted",
                "driving_review",
                "vehicle_review",
                "compliance_review",
                "more_information",
              ],
            },
          }),
          evidence: await Booking.countDocuments({
            status: "evidence_submitted",
          }),
          issues: await Issue.countDocuments({ status: "open" }),
          nextSevenDays: await Booking.countDocuments({
            scheduledAt: {
              $gte: new Date(),
              $lt: new Date(Date.now() + 7 * 86400_000),
            },
            status: { $nin: ["cancelled", "closed", "completed"] },
          }),
        }
      : {};
    return ok({ rows, counts });
  } catch (error) {
    return errorResponse(error);
  }
}
