import { z } from "zod";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { objectId } from "@/lib/operations/validation";
import { driverMilestones } from "@/lib/operations/policy";
import {
  acceptOffer,
  advanceJob,
  releaseOffer,
  saveEvidence,
} from "@/lib/operations/dispatch";
import { Assignment, Issue } from "@/lib/operations/models";
import { audit, notifyStaff } from "@/lib/operations/events";
import { connectDB } from "@/lib/db";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
const actions = z.discriminatedUnion("action", [
  z.object({ action: z.literal("accept") }),
  z.object({ action: z.literal("decline"), note: z.string().min(3).max(1000) }),
  z.object({
    action: z.literal("milestone"),
    status: z.enum(driverMilestones),
    note: z.string().max(1000).default(""),
    version: z.number().int(),
  }),
  z.object({
    action: z.literal("issue"),
    kind: z.enum([
      "delay",
      "access",
      "extra_waste",
      "restricted_waste",
      "vehicle",
      "other",
    ]),
    note: z.string().min(5).max(2000),
  }),
  z.object({
    action: z.literal("evidence"),
    beforeAssetIds: z.array(objectId).max(12),
    afterAssetIds: z.array(objectId).max(12),
    receiptAssetId: objectId.optional(),
    receiptNumber: z.string().max(100).default(""),
    wasteDescription: z.string().max(1000).default(""),
    ewcCode: z.string().max(30).default(""),
    weightKg: z.number().nonnegative().optional(),
    deliveredAt: z.string().datetime().optional(),
  }),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser();
    requireCondition(user.role === "driver", "Driver account required", 403);
    requireCondition(
      !user.driverPasswordPending,
      "Set your password using the approval email before accessing driver work.",
      403,
    );
    const id = objectId.parse((await params).id);
    const data = actions.parse(await req.json());
    await connectDB();
    const assignment = await Assignment.findOne({
      _id: id,
      driverId: user.id,
      live: true,
    });
    requireCondition(assignment, "Assignment not found", 404);
    if (data.action === "accept") await acceptOffer(id, user.id);
    if (data.action === "decline") {
      requireCondition(
        assignment.status === "offered",
        "An accepted job needs dispatcher intervention",
        409,
      );
      await releaseOffer(id, "rejected", user.id, data.note);
    }
    if (data.action === "milestone")
      await advanceJob(id, user.id, data.status, data.note, data.version);
    if (data.action === "evidence") await saveEvidence(id, user.id, data);
    if (data.action === "issue") {
      await Issue.create({
        bookingId: assignment.bookingId,
        openedBy: user.id,
        kind: data.kind,
        note: data.note,
        dueAt: new Date(Date.now() + 3600_000),
      });
      await audit(user.id, "issue.opened", String(assignment.bookingId), {
        kind: data.kind,
      });
      await notifyStaff(
        `issue:${id}:${Date.now()}`,
        "job_issue",
        String(assignment.bookingId),
        data.note,
        `/admin/jobs/${assignment.bookingId}`,
      );
    }
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
