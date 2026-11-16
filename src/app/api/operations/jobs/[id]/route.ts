import { z } from "zod";
import { connectDB } from "@/lib/db";
import { Booking, Quote, Audit } from "@/lib/models";
import {
  Assignment,
  DriverApplication,
  Evidence,
  Facility,
  Issue,
  OperationsPolicy,
  Payout,
  UploadAsset,
} from "@/lib/operations/models";
import { objectId, pence } from "@/lib/operations/validation";
import {
  backoffice,
  permitted,
  driverEligible,
  availableForJob,
} from "@/lib/operations/policy";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { createOffer, releaseOffer } from "@/lib/operations/dispatch";
import { ownAssets } from "@/lib/operations/assets";
import { audit, notify } from "@/lib/operations/events";
import { ok, fail, errorResponse, ensureSameOrigin } from "@/lib/http";
export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    requireCondition(backoffice(user.role), "Staff access required", 403);
    const id = objectId.parse((await params).id);
    await connectDB();
    const booking = await Booking.findById(id).lean();
    requireCondition(booking, "Job not found", 404);
    const quote = booking.quoteId
      ? await Quote.findById(booking.quoteId).lean()
      : null;
    const assignments = await Assignment.find({ bookingId: id })
      .sort({ createdAt: -1 })
      .lean();
    const evidence = await Evidence.find({ bookingId: id }).lean();
    const issues = await Issue.find({ bookingId: id })
      .sort({ createdAt: -1 })
      .lean();
    const history = await Audit.find({
      entityId: {
        $in: [id, ...(booking.quoteId ? [String(booking.quoteId)] : [])],
      },
    })
      .sort({ createdAt: -1 })
      .limit(150)
      .lean();
    const policy = await OperationsPolicy.findOne({ key: "operations" }).lean();
    const drivers = permitted(user.role, "operations")
      ? await DriverApplication.find({
          status: "active",
          online: true,
          availableUntilAt: { $gt: new Date() },
        })
          .select(
            "userId legalName availableDays availableFrom availableUntil coveragePrefixes capacityKg capacityM3 wasteTypes dateOfBirth points disqualified licenceExpiresAt insuranceExpiresAt carrierExpiresAt motExpiresAt checks status",
          )
          .lean()
      : [];
    const candidates = drivers
      .filter(
        (driver) =>
          policy?.approved &&
          driverEligible(
            driver,
            booking.scheduledAt ?? new Date(),
            policy.minAge,
            policy.maxPoints,
          ) &&
          availableForJob(driver, {
            ...booking,
            postcode: booking.address?.postcode,
          }),
      )
      .map((driver) => ({
        userId: String(driver.userId),
        name: driver.legalName,
        capacityKg: driver.capacityKg,
        capacityM3: driver.capacityM3,
      }));
    const facilities = await Facility.find({ active: true }).lean();
    const payouts = permitted(user.role, "finance")
      ? await Payout.find({ bookingId: id }).lean()
      : [];
    return ok({
      booking,
      quote,
      assignments,
      evidence,
      issues,
      history,
      candidates,
      facilities,
      payouts,
      permissions: {
        dispatch: permitted(user.role, "operations"),
        verify: permitted(user.role, "verify"),
        finance: permitted(user.role, "finance"),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("plan"),
    version: z.number().int(),
    expectedWeightKg: z.number().positive().max(30000),
    expectedVolumeM3: z.number().positive().max(100),
    wasteType: z.enum([
      "mixed",
      "furniture",
      "garden",
      "construction",
      "appliances",
    ]),
    note: z.string().min(3).max(1000),
  }),
  z.object({
    action: z.literal("offer"),
    driverId: objectId,
    facilityId: objectId,
    driverMinor: pence,
    disposalMinor: pence,
    processorMinor: pence,
    contingencyMinor: pence,
    passThroughMinor: pence,
    minutes: z.number().int().min(5).max(120),
  }),
  z.object({
    action: z.literal("reassign"),
    assignmentId: objectId,
    note: z.string().min(5).max(1000),
  }),
  z.object({
    action: z.literal("verify"),
    evidenceId: objectId,
    approved: z.boolean(),
    note: z.string().min(5).max(2000),
    transferNoteAssetId: objectId.optional(),
  }),
  z.object({
    action: z.literal("resolve_issue"),
    customerApprovalReference: z.string().min(3).max(300).optional(),
    issueId: objectId,
    note: z.string().min(5).max(2000),
  }),
]);
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser();
    const id = objectId.parse((await params).id);
    const data = actionSchema.parse(await req.json());
    requireCondition(
      permitted(user.role, data.action === "verify" ? "verify" : "operations"),
      "Not permitted",
      403,
    );
    const db = await connectDB();
    if (data.action === "offer") {
      await createOffer(user.id, { ...data, bookingId: id });
      return ok({ offered: true });
    }
    if (data.action === "reassign") {
      requireCondition(
        await Assignment.exists({ _id: data.assignmentId, bookingId: id }),
        "Assignment not found",
        404,
      );
      await releaseOffer(data.assignmentId, "cancelled", user.id, data.note);
      return ok({ released: true });
    }
    await db.connection.transaction(async (session) => {
      if (data.action === "plan") {
        const changed = await Booking.updateOne(
          {
            _id: id,
            version: data.version,
            status: { $in: ["pending_payment", "confirmed"] },
            assignmentId: { $exists: false },
          },
          {
            $set: {
              expectedWeightKg: data.expectedWeightKg,
              expectedVolumeM3: data.expectedVolumeM3,
              wasteType: data.wasteType,
              notes: data.note,
            },
            $inc: { version: 1 },
          },
          { session },
        );
        requireCondition(
          changed.modifiedCount,
          "Job changed or has an assignment",
          409,
        );
        await audit(user.id, "job.planned", id, data, session);
      }
      if (data.action === "resolve_issue") {
        const issue = await Issue.findOne({
          _id: data.issueId,
          bookingId: id,
          status: "open",
        }).session(session);
        requireCondition(issue, "Issue not found", 404);
        if (issue.kind === "extra_waste")
          requireCondition(
            data.customerApprovalReference,
            "Record the customer approval or agreed original-scope confirmation before resolving extra waste",
          );
        const changed = await Issue.updateOne(
          { _id: data.issueId, bookingId: id, status: "open" },
          {
            $set: {
              status: "resolved",
              resolution: data.note,
              customerApprovalReference: data.customerApprovalReference,
              resolvedBy: user.id,
              resolvedAt: new Date(),
            },
          },
          { session },
        );
        requireCondition(changed.modifiedCount, "Issue already resolved", 409);
        await audit(
          user.id,
          "issue.resolved",
          id,
          { note: data.note, issueId: data.issueId },
          session,
        );
      }
      if (data.action === "verify") {
        const evidence = await Evidence.findOne({
          _id: data.evidenceId,
          bookingId: id,
          status: "submitted",
        }).session(session);
        requireCondition(
          evidence && String(evidence.driverId) !== user.id,
          "Submitted evidence requires an independent reviewer",
          409,
        );
        const assignment = await Assignment.findOne({
          _id: evidence.assignmentId,
          live: true,
          status: "evidence_submitted",
        }).session(session);
        requireCondition(assignment, "Assignment cannot be verified", 409);
        const facility = await Facility.findById(evidence.facilityId).session(
          session,
        );
        if (data.approved) {
          requireCondition(
            facility?.active &&
              facility.checkedAt &&
              facility.expiresAt &&
              evidence.deliveredAt &&
              facility.expiresAt.getTime() > evidence.deliveredAt.getTime() &&
              facility.wasteTypes.length &&
              evidence.beforeAssetIds.length &&
              evidence.afterAssetIds.length &&
              evidence.receiptAssetId &&
              evidence.receiptNumber,
            "Verify the facility, receipt and complete pickup evidence first",
          );
          if (data.transferNoteAssetId) {
            await ownAssets(
              [data.transferNoteAssetId],
              user.id,
              "transfer_note",
              session,
            );
            await UploadAsset.updateOne(
              { _id: data.transferNoteAssetId },
              { $set: { bookingId: id } },
              { session },
            );
          }
        }
        const changed = await Evidence.updateOne(
          { _id: evidence._id, status: "submitted" },
          {
            $set: {
              status: data.approved ? "verified" : "rejected",
              verificationNote: data.note,
              verifierId: user.id,
              verifiedAt: data.approved ? new Date() : undefined,
              transferNoteAssetId: data.approved
                ? data.transferNoteAssetId
                : undefined,
            },
          },
          { session },
        );
        requireCondition(changed.modifiedCount, "Evidence changed", 409);
        await Assignment.updateOne(
          { _id: assignment._id, status: "evidence_submitted" },
          {
            $set: {
              status: data.approved ? "approved" : "active",
              live: !data.approved,
            },
            $inc: { version: 1 },
          },
          { session },
        );
        const booking = await Booking.findOneAndUpdate(
          { _id: id, status: "evidence_submitted" },
          {
            $set: { status: data.approved ? "verified" : "at_facility" },
            $inc: { version: 1 },
            $push: {
              events: {
                status: data.approved ? "verified" : "at_facility",
                note: data.approved
                  ? "Collection and facility evidence verified by staff"
                  : "Evidence needs correction",
                by: user.id,
                at: new Date(),
              },
            },
          },
          { session, new: true },
        );
        requireCondition(booking, "Job status changed", 409);
        await audit(
          user.id,
          data.approved ? "evidence.verified" : "evidence.rejected",
          id,
          { note: data.note, evidenceId: data.evidenceId },
          session,
        );
        await notify(
          {
            key: `evidence:${evidence._id}:${assignment.version}`,
            event: data.approved ? "evidence_verified" : "evidence_correction",
            reference: booking.reference ?? id,
            recipientId: String(
              data.approved ? booking.userId : evidence.driverId,
            ),
            subject: data.approved
              ? "Your collection evidence has been verified"
              : "Collection evidence needs correction",
            message: data.approved
              ? "Your collection and facility evidence have been reviewed. Your records are available in your account."
              : data.note,
            href: data.approved ? `/account/bookings/${id}` : "/driver",
          },
          session,
        );
      }
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
