import { Booking, User } from "@/lib/models";
import { connectDB } from "@/lib/db";
import {
  Assignment,
  DriverApplication,
  Evidence,
  Facility,
  OperationsPolicy,
  Payout,
  UploadAsset,
  Issue,
} from "./models";
import {
  driverEligible,
  availableForJob,
  economics,
  validMilestone,
  type DriverMilestone,
} from "./policy";
import { requireCondition } from "./security";
import { audit, notify, notifyStaff } from "./events";
import { ownAssets } from "./assets";
export async function createOffer(
  actorId: string,
  input: {
    bookingId: string;
    driverId: string;
    facilityId: string;
    driverMinor: number;
    disposalMinor: number;
    processorMinor: number;
    contingencyMinor: number;
    passThroughMinor: number;
    minutes: number;
  },
) {
  const db = await connectDB();
  return db.connection.transaction(async (session) => {
    const booking = await Booking.findById(input.bookingId).session(session);
    const driver = await DriverApplication.findOne({
      userId: input.driverId,
    }).session(session);
    const policy = await OperationsPolicy.findOne({
      key: "operations",
    }).session(session);
    const facility = await Facility.findById(input.facilityId).session(session);
    requireCondition(
      booking &&
        booking.paymentStatus === "paid" &&
        !booking.refundsMinor &&
        !booking.chargebackMinor &&
        booking.status === "confirmed" &&
        !booking.assignmentId,
      "Job must be paid, scheduled and unassigned",
      409,
    );
    requireCondition(
      policy?.approved,
      "Owner must approve the operations and margin policy first",
    );
    requireCondition(
      driver &&
        driverEligible(
          driver.toObject(),
          booking.scheduledAt ?? new Date(),
          policy.minAge,
          policy.maxPoints,
        ) &&
        driver.online &&
        driver.availableUntilAt &&
        driver.availableUntilAt.getTime() > Date.now(),
      "Driver is not approved, in date or available",
      409,
    );
    requireCondition(
      availableForJob(driver.toObject(), {
        ...booking.toObject(),
        postcode: booking.address?.postcode,
      }),
      "Driver coverage, hours, vehicle capacity or waste type does not fit this job",
    );
    requireCondition(
      facility &&
        facility.active &&
        facility.checkedAt &&
        facility.expiresAt &&
        facility.expiresAt.getTime() >
          Math.max(Date.now(), booking.scheduledAt?.getTime() ?? 0) &&
        facility.wasteTypes.includes(booking.wasteType ?? "mixed"),
      "Choose an approved, in-date facility accepting this waste",
    );
    const base = {
      totalMinor: booking.price?.totalMinor ?? 0,
      vatMinor: booking.price?.vatMinor ?? 0,
      refundsMinor: booking.refundsMinor,
      passThroughMinor: input.passThroughMinor,
      disposalMinor: input.disposalMinor,
      processorMinor: input.processorMinor,
      contingencyMinor: input.contingencyMinor,
      driverMinor: input.driverMinor,
      minimumMarginMinor: policy.minimumMarginMinor,
    };
    if (policy.driverPayMode === "percentage")
      base.driverMinor = Math.round(
        ((base.totalMinor -
          base.vatMinor -
          base.refundsMinor -
          base.passThroughMinor) *
          policy.driverRateBps) /
          10000,
      );
    const calculation = economics(base);
    requireCondition(
      calculation.passes,
      "Offer is below the approved margin. Reprice or review costs first",
    );
    requireCondition(base.driverMinor > 0, "Confirm a positive driver offer");
    const locked = await DriverApplication.updateOne(
      { _id: driver._id, version: driver.version, online: true },
      { $set: { online: false }, $inc: { version: 1 } },
      { session },
    );
    requireCondition(locked.modifiedCount, "Driver availability changed", 409);
    const [assignment] = await Assignment.create(
      [
        {
          bookingId: booking._id,
          driverId: driver.userId,
          facilityId: facility._id,
          offerMinor: base.driverMinor,
          economics: { ...base, ...calculation },
          policyVersion: policy.version,
          offeredBy: actorId,
          expiresAt: new Date(Date.now() + input.minutes * 60_000),
        },
      ],
      { session },
    );
    const changed = await Booking.updateOne(
      {
        _id: booking._id,
        status: "confirmed",
        assignmentId: { $exists: false },
      },
      {
        $set: { assignmentId: assignment._id, facilityId: facility._id },
        $inc: { version: 1 },
        $push: {
          events: {
            status: "confirmed",
            note: "Driver offer sent",
            by: actorId,
            at: new Date(),
          },
        },
      },
      { session },
    );
    requireCondition(changed.modifiedCount, "Job already has an offer", 409);
    await Payout.create(
      [
        {
          assignmentId: assignment._id,
          bookingId: booking._id,
          driverId: driver.userId,
          offeredMinor: base.driverMinor,
        },
      ],
      { session },
    );
    const account = await User.findById(driver.userId).session(session).lean();
    await notify(
      {
        key: `offer:${assignment._id}`,
        event: "job_offer",
        reference: booking.reference ?? "",
        recipientId: String(driver.userId),
        email: account?.email,
        subject: "You have a collection offer",
        message: `A collection offer is ready to review. Offered driver pay: £${(base.driverMinor / 100).toFixed(2)}.`,
        href: "/driver",
      },
      session,
    );
    await audit(
      actorId,
      "assignment.offered",
      String(booking._id),
      {
        assignmentId: String(assignment._id),
        driverId: input.driverId,
        economics: { ...base, ...calculation },
      },
      session,
    );
    return assignment;
  });
}
export async function releaseOffer(
  assignmentId: string,
  status: "rejected" | "timed_out" | "cancelled",
  actorId: string,
  reason: string,
) {
  const db = await connectDB();
  await db.connection.transaction(async (session) => {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: assignmentId,
        live: true,
        status:
          status === "timed_out"
            ? "offered"
            : { $in: ["offered", "accepted", "active"] },
        ...(status === "timed_out" ? { expiresAt: { $lte: new Date() } } : {}),
      },
      { $set: { status, live: false, reason }, $inc: { version: 1 } },
      { session, new: true },
    );
    if (!assignment) return;
    const booking = await Booking.findOneAndUpdate(
      {
        _id: assignment.bookingId,
        assignmentId: assignment._id,
        status: { $in: ["confirmed", "assigned", "en_route", "arrived"] },
      },
      {
        $unset: { assignmentId: "", assignedCrewId: "", facilityId: "" },
        $set: { status: "confirmed" },
        $inc: { version: 1 },
        $push: {
          events: {
            status: "confirmed",
            note: `Assignment ${status}: ${reason}`,
            at: new Date(),
            by: actorId,
          },
        },
      },
      { session, new: true },
    );
    requireCondition(
      booking,
      "Collected jobs require a documented exception review before reassignment",
      409,
    );
    await Payout.updateOne(
      { assignmentId: assignment._id, status: { $ne: "paid" } },
      { $set: { status: "held", holdReason: reason } },
      { session },
    );
    await audit(
      actorId,
      `assignment.${status}`,
      String(booking._id),
      { assignmentId, reason },
      session,
    );
    await notifyStaff(
      `assignment:${assignmentId}:${status}`,
      "dispatch_attention",
      booking.reference ?? "",
      reason,
      `/admin/jobs/${booking._id}`,
      session,
    );
  });
}
export async function acceptOffer(assignmentId: string, driverId: string) {
  const db = await connectDB();
  await db.connection.transaction(async (session) => {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: assignmentId,
        driverId,
        live: true,
        status: "offered",
        expiresAt: { $gt: new Date() },
      },
      {
        $set: { status: "accepted", acceptedAt: new Date() },
        $inc: { version: 1 },
      },
      { session, new: true },
    );
    requireCondition(assignment, "Offer expired or was already handled", 409);
    const driver = await DriverApplication.findOne({
      userId: driverId,
    }).session(session);
    const policy = await OperationsPolicy.findOne({
      key: "operations",
    }).session(session);
    const booking = await Booking.findById(assignment.bookingId).session(
      session,
    );
    requireCondition(
      driver &&
        policy?.approved &&
        booking &&
        driverEligible(
          driver.toObject(),
          booking.scheduledAt ?? new Date(),
          policy.minAge,
          policy.maxPoints,
        ),
      "Eligibility changed; contact operations",
      403,
    );
    requireCondition(
      availableForJob(driver.toObject(), {
        ...booking.toObject(),
        postcode: booking.address?.postcode,
      }),
      "Job no longer fits approved availability",
    );
    const changed = await Booking.updateOne(
      {
        _id: assignment.bookingId,
        assignmentId: assignment._id,
        status: "confirmed",
        paymentStatus: "paid",
      },
      {
        $set: { status: "assigned", assignedCrewId: driverId },
        $inc: { version: 1 },
        $push: {
          events: {
            status: "assigned",
            note: "Driver accepted the collection",
            by: driverId,
            at: new Date(),
          },
        },
      },
      { session },
    );
    requireCondition(changed.modifiedCount, "Job is no longer available", 409);
    await Payout.updateOne(
      { assignmentId: assignment._id, status: "estimated" },
      { $set: { status: "conditional" } },
      { session },
    );
    await notify(
      {
        key: `booking:${booking._id}:assigned`,
        event: "driver_assigned",
        reference: booking.reference ?? "",
        recipientId: String(booking.userId),
        subject: "Your collection team is confirmed",
        message: `Your collection ${booking.reference} has an assigned driver. View your account for the scheduled window.`,
        href: `/account/bookings/${booking._id}`,
      },
      session,
    );
    await audit(
      driverId,
      "assignment.accepted",
      String(booking._id),
      { assignmentId },
      session,
    );
  });
}
export async function advanceJob(
  assignmentId: string,
  driverId: string,
  status: DriverMilestone,
  note: string,
  version: number,
) {
  const db = await connectDB();
  await db.connection.transaction(async (session) => {
    const assignment = await Assignment.findOne({
      _id: assignmentId,
      driverId,
      live: true,
      version,
      status: { $in: ["accepted", "active"] },
    }).session(session);
    requireCondition(assignment, "Assignment changed or is not active", 409);
    const booking = await Booking.findById(assignment.bookingId).session(
      session,
    );
    requireCondition(
      booking && validMilestone(booking.status, status),
      "That milestone cannot follow the current job status",
      409,
    );
    const driver = await DriverApplication.findOne({
      userId: driverId,
    }).session(session);
    const policy = await OperationsPolicy.findOne({
      key: "operations",
    }).session(session);
    requireCondition(
      driver &&
        policy &&
        driverEligible(
          driver.toObject(),
          new Date(),
          policy.minAge,
          policy.maxPoints,
        ),
      "Driver documents need review",
      403,
    );
    const evidence = await Evidence.findOne({
      assignmentId: assignment._id,
    }).session(session);
    if (status === "collected") {
      const blocked = await Issue.exists({
        bookingId: booking._id,
        status: "open",
        kind: { $in: ["extra_waste", "restricted_waste"] },
      }).session(session);
      requireCondition(
        !blocked,
        "Operations must resolve the waste/scope exception before collection",
      );
    }
    if (status === "collected")
      requireCondition(
        evidence?.beforeAssetIds.length && evidence.afterAssetIds.length,
        "Upload before and after pickup photos first",
      );
    if (status === "evidence_submitted") {
      requireCondition(
        evidence?.beforeAssetIds.length &&
          evidence.afterAssetIds.length &&
          evidence.receiptAssetId &&
          evidence.receiptNumber &&
          evidence.wasteDescription &&
          evidence.deliveredAt &&
          String(evidence.facilityId) === String(assignment.facilityId),
        "Facility receipt, delivery details and pickup evidence are required",
      );
      await Evidence.updateOne(
        { _id: evidence._id },
        { $set: { status: "submitted", submittedAt: new Date() } },
        { session },
      );
    }
    const changed = await Assignment.updateOne(
      { _id: assignment._id, version },
      {
        $set: {
          status:
            status === "evidence_submitted" ? "evidence_submitted" : "active",
        },
        $inc: { version: 1 },
      },
      { session },
    );
    requireCondition(changed.modifiedCount, "Assignment changed", 409);
    const moved = await Booking.updateOne(
      {
        _id: booking._id,
        status: booking.status,
        assignmentId: assignment._id,
      },
      {
        $set: { status },
        $inc: { version: 1 },
        $push: { events: { status, note, by: driverId, at: new Date() } },
      },
      { session },
    );
    requireCondition(moved.modifiedCount, "Job changed", 409);
    await audit(
      driverId,
      `job.${status}`,
      String(booking._id),
      { assignmentId, note },
      session,
    );
    await notify(
      {
        key: `booking:${booking._id}:${status}`,
        event: status,
        reference: booking.reference ?? "",
        recipientId: String(booking.userId),
        subject: `Collection update: ${status.replaceAll("_", " ")}`,
        message:
          status === "collected"
            ? "Your waste has been collected. Facility evidence is still awaiting verification."
            : `Collection ${booking.reference}: ${status.replaceAll("_", " ")}.`,
        href: `/account/bookings/${booking._id}`,
      },
      session,
    );
  });
}
export async function saveEvidence(
  assignmentId: string,
  driverId: string,
  input: {
    beforeAssetIds: string[];
    afterAssetIds: string[];
    receiptAssetId?: string;
    receiptNumber: string;
    wasteDescription: string;
    ewcCode: string;
    weightKg?: number;
    deliveredAt?: string;
  },
) {
  const ids = [
    ...input.beforeAssetIds,
    ...input.afterAssetIds,
    ...(input.receiptAssetId ? [input.receiptAssetId] : []),
  ];
  await ownAssets(ids, driverId, "evidence");
  const db = await connectDB();
  await db.connection.transaction(async (session) => {
    const assignment = await Assignment.findOneAndUpdate(
      {
        _id: assignmentId,
        driverId,
        live: true,
        status: { $in: ["accepted", "active"] },
      },
      { $inc: { version: 1 } },
      { session, new: true },
    );
    requireCondition(
      assignment,
      "Evidence can only be added to your active job",
      403,
    );
    requireCondition(
      !input.beforeAssetIds.some((id) => input.afterAssetIds.includes(id)),
      "Before and after pickup must use separate photographs",
    );
    if (input.deliveredAt) {
      const delivered = new Date(input.deliveredAt).getTime();
      requireCondition(
        assignment.acceptedAt &&
          delivered >= assignment.acceptedAt.getTime() &&
          delivered <= Date.now() + 300_000,
        "Facility delivery must be after acceptance and cannot be in the future",
      );
    }
    await Evidence.updateOne(
      { assignmentId: assignment._id, status: { $in: ["draft", "rejected"] } },
      {
        $set: {
          ...input,
          deliveredAt: input.deliveredAt
            ? new Date(input.deliveredAt)
            : undefined,
          facilityId: assignment.facilityId,
          bookingId: assignment.bookingId,
          driverId,
          status: "draft",
        },
      },
      { upsert: true, session },
    );
    const attached = await UploadAsset.updateMany(
      {
        _id: { $in: ids },
        ownerId: driverId,
        purpose: "evidence",
        $or: [
          { bookingId: { $exists: false } },
          { bookingId: assignment.bookingId },
        ],
      },
      { $set: { bookingId: assignment.bookingId } },
      { session },
    );
    requireCondition(
      attached.matchedCount === new Set(ids).size,
      "Evidence files are already attached to another collection",
      409,
    );
    await audit(
      driverId,
      "evidence.saved",
      String(assignment.bookingId),
      { assignmentId, assetCount: ids.length },
      session,
    );
  });
}
