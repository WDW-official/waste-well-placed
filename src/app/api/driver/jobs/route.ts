import { requireUser, requireCondition } from "@/lib/operations/security";
import { connectDB } from "@/lib/db";
import {
  Assignment,
  DriverApplication,
  Evidence,
  Facility,
  Notification,
  OperationsPolicy,
  Payout,
} from "@/lib/operations/models";
import { Booking } from "@/lib/models";
import { driverEligible } from "@/lib/operations/policy";
import { ok, errorResponse } from "@/lib/http";
export async function GET() {
  try {
    const user = await requireUser();
    requireCondition(user.role === "driver", "Driver account required", 403);
    requireCondition(
      !user.driverPasswordPending,
      "Set your password using the approval email before accessing driver work.",
      403,
    );
    await connectDB();
    const profile = await DriverApplication.findOne({ userId: user.id })
      .select("-draft")
      .lean();
    const policy = await OperationsPolicy.findOne({ key: "operations" }).lean();
    const eligible = !!(
      profile &&
      policy?.approved &&
      driverEligible(profile, new Date(), policy.minAge, policy.maxPoints)
    );
    const assignments = eligible
      ? await Assignment.find({
          driverId: user.id,
          live: true,
          $or: [
            { status: { $ne: "offered" } },
            { expiresAt: { $gt: new Date() } },
          ],
        })
          .sort({ createdAt: -1 })
          .lean()
      : [];
    const jobs = [];
    for (const assignment of assignments) {
      const booking = await Booking.findById(assignment.bookingId)
        .select(
          "reference address scheduledAt status contact photos expectedWeightKg expectedVolumeM3 wasteType",
        )
        .lean();
      const facility = await Facility.findById(assignment.facilityId)
        .select("name address postcode wasteTypes")
        .lean();
      const evidence = await Evidence.findOne({
        assignmentId: assignment._id,
      }).lean();
      // An unaccepted offer exposes zone/load/pay, never full customer contact or private photos.
      jobs.push({
        assignment,
        booking:
          booking && assignment.status === "offered"
            ? {
                reference: booking.reference,
                address: {
                  postcode: booking.address?.postcode
                    ?.replace(/\s/g, "")
                    .slice(0, -3),
                },
                scheduledAt: booking.scheduledAt,
                status: booking.status,
                expectedWeightKg: booking.expectedWeightKg,
                expectedVolumeM3: booking.expectedVolumeM3,
                wasteType: booking.wasteType,
              }
            : booking,
        facility,
        evidence,
      });
    }
    const payouts = await Payout.find({ driverId: user.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const notifications = await Notification.find({ recipientId: user.id })
      .select("event subject message createdAt href")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    return ok({ profile, eligible, jobs, payouts, notifications });
  } catch (error) {
    return errorResponse(error);
  }
}
