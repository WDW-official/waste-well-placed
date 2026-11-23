import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { type Model } from "mongoose";
const provider = vi.hoisted(() => ({
  event: null as unknown,
  refund: vi.fn(),
  refundLookup: vi.fn(),
  charge: vi.fn(),
  checkout: vi.fn(),
}));
vi.mock("@/lib/stripe", () => ({
  stripeClient: () => ({
    webhooks: { constructEvent: () => provider.event },
    refunds: { create: provider.refund, retrieve: provider.refundLookup },
    charges: { retrieve: provider.charge },
    checkout: { sessions: { create: provider.checkout } },
  }),
}));
const actor = vi.hoisted(() => ({
  id: "",
  role: "admin",
  email: "ops@example.test",
  name: "Test operator",
  organizationId: null as string | null,
}));
const createdSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({
  getSession: vi.fn(async () => actor),
  createSession: createdSession,
  isStaff: (role: string) =>
    ["admin", "superadmin", "dispatcher"].includes(role),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));
import { connectDB } from "@/lib/db";
import {
  Booking,
  Catalog,
  Organization,
  Quote,
  User,
  Audit,
  Zone,
  Slot,
  Hold,
  Payment,
} from "@/lib/models";
import {
  Assignment,
  DriverApplication,
  Evidence,
  Facility,
  OperationsPolicy,
  Payout,
  UploadAsset,
  Notification,
  Issue,
  RateLimit,
  ProviderEvent,
} from "@/lib/operations/models";
import {
  createOffer,
  acceptOffer,
  advanceJob,
  releaseOffer,
  saveEvidence,
} from "@/lib/operations/dispatch";
import { POST as verify } from "@/app/api/operations/jobs/[id]/route";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { POST as submitQuote } from "@/app/api/quotes/route";
import { PATCH as priceQuote } from "@/app/api/admin/quotes/[id]/route";
import { POST as decideQuote } from "@/app/api/quotes/[id]/route";
import { GET as privateAsset } from "@/app/api/assets/[id]/route";
import { PATCH as reviewDriver } from "@/app/api/admin/drivers/[id]/route";
import { POST as settle } from "@/app/api/operations/payouts/[id]/route";
import { POST as createBooking } from "@/app/api/bookings/route";
import { POST as registerDriver } from "@/app/api/driver/register/route";
import { POST as driverAccess } from "@/app/api/driver/access/route";
import { POST as requestDriverAccess } from "@/app/api/driver/request-access/route";
import { hashToken } from "@/lib/operations/security";
import bcrypt from "bcryptjs";
import {
  Tariff,
  CompanyProfile,
  BookingChange,
  RefundRequest,
  Invoice,
  Counter,
  Review,
} from "@/lib/workflow-models";
import { quotePrice } from "@/lib/catalog";
import { releaseExpiredHolds } from "@/lib/slot-holds";
import { POST as reserveSlot } from "@/app/api/slot-holds/route";
import { POST as forgotPassword } from "@/app/api/auth/forgot-password/route";
import { POST as resetPassword } from "@/app/api/auth/reset-password/route";
import { POST as requestChange } from "@/app/api/bookings/[id]/changes/route";
import { POST as reviewChange } from "@/app/api/operations/bookings/[id]/changes/route";
import { POST as issueInvoice } from "@/app/api/operations/bookings/[id]/invoice/route";
import { POST as companyVehicle } from "@/app/api/admin/drivers/[id]/vehicle/route";
import { processRefunds } from "@/lib/refunds";
import { GET as report } from "@/app/api/business/reports/route";
import { POST as onboardBusiness } from "@/app/api/operations/organizations/route";
import { PATCH as editAdminRecord } from "@/app/api/admin/record/route";
import { GET as adminCollections } from "@/app/api/admin/collections/route";
let replica: MongoMemoryReplSet;
let driverId: string;
let bookingId: string;
let facilityId: string;
const models: Model<unknown>[] = [
  Booking,
  Catalog,
  Organization,
  Tariff,
  CompanyProfile,
  BookingChange,
  RefundRequest,
  Invoice,
  Counter,
  Review,
  Quote,
  User,
  Audit,
  Zone,
  Slot,
  Hold,
  Payment,
  Assignment,
  DriverApplication,
  Evidence,
  Facility,
  OperationsPolicy,
  Payout,
  UploadAsset,
  Notification,
  Issue,
  RateLimit,
  ProviderEvent,
] as unknown as Model<unknown>[];
beforeAll(async () => {
  replica = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  process.env.MONGODB_URI = replica.getUri("wwp_operations_test");
  process.env.STRIPE_WEBHOOK_SECRET = "isolated-test-secret";
  await connectDB();
  for (const model of models) {
    await model.createCollection();
    await model.createIndexes();
  }
});
afterAll(async () => {
  await mongoose.disconnect();
  if (replica) await replica.stop();
  delete process.env.MONGODB_URI;
});
beforeEach(async () => {
  for (const model of models) await model.deleteMany({});
  actor.organizationId = null;
  delete process.env.STRIPE_SECRET_KEY;
  provider.refund.mockReset();
  provider.refundLookup.mockReset();
  provider.charge.mockReset();
  provider.checkout.mockReset();
  const customer = await User.create({
    name: "Test customer",
    email: "customer@example.test",
    passwordHash: "not-a-login",
    role: "customer",
  });
  const staff = await User.create({
    name: "Test operator",
    email: "ops@example.test",
    passwordHash: "not-a-login",
    role: "admin",
  });
  actor.id = String(staff._id);
  actor.role = "admin";
  const driver = await User.create({
    name: "Test driver",
    email: "driver@example.test",
    passwordHash: "not-a-login",
    role: "driver",
  });
  driverId = String(driver._id);
  const future = new Date(Date.now() + 365 * 86400_000);
  await DriverApplication.create({
    userId: driver._id,
    status: "active",
    legalName: "Test driver",
    dateOfBirth: new Date("1990-01-01"),
    points: 0,
    disqualified: false,
    licenceExpiresAt: future,
    insuranceExpiresAt: future,
    carrierExpiresAt: future,
    motExpiresAt: future,
    checks: {
      identity: true,
      licence: true,
      insurance: true,
      carrier: true,
      vehicle: true,
      contract: true,
    },
    availableDays: [0, 1, 2, 3, 4, 5, 6],
    availableFrom: "00:00",
    availableUntil: "23:59",
    coveragePrefixes: ["SW1A"],
    wasteTypes: ["mixed"],
    capacityKg: 1000,
    capacityM3: 20,
    online: true,
    availableUntilAt: future,
  });
  await OperationsPolicy.create({
    key: "operations",
    approved: true,
    minAge: 21,
    maxPoints: 6,
    minimumMarginMinor: 1000,
  });
  const facility = await Facility.create({
    name: "Test facility only",
    permitReference: "TEST-NOT-A-REAL-PERMIT",
    active: true,
    checkedAt: new Date(),
    expiresAt: future,
    wasteTypes: ["mixed"],
  });
  facilityId = String(facility._id);
  const booking = await Booking.create({
    reference: `TEST-${Date.now()}`,
    userId: customer._id,
    paymentStatus: "paid",
    status: "confirmed",
    scheduledAt: new Date(Date.now() + 3600_000),
    price: { totalMinor: 12000, vatMinor: 2000 },
    address: { line1: "Test address", postcode: "SW1A 1AA" },
    expectedWeightKg: 200,
    expectedVolumeM3: 4,
    wasteType: "mixed",
  });
  bookingId = String(booking._id);
});
function offer() {
  return createOffer(actor.id, {
    bookingId,
    driverId,
    facilityId,
    driverMinor: 4000,
    disposalMinor: 2500,
    processorMinor: 300,
    contingencyMinor: 100,
    passThroughMinor: 0,
    minutes: 30,
  });
}
function request(body: unknown) {
  return new Request("https://example.test/api", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "https://example.test",
    },
    body: JSON.stringify(body),
  });
}
describe("admin record actions", () => {
  it("saves typed changes together and rejects immutable fields", async () => {
    const item = await Catalog.create({
      key: "modal-test",
      title: "Original item",
      category: "furniture",
      priceMinor: 5900,
      active: true,
    });
    const result = await editAdminRecord(
      request({
        name: "catalog",
        id: String(item._id),
        patch: { title: "Updated item", priceMinor: 6400, active: false },
      }),
    );
    expect(result.status).toBe(200);
    const saved = await Catalog.findById(item._id).lean();
    expect(saved).toMatchObject({
      title: "Updated item",
      priceMinor: 6400,
      active: false,
      key: "modal-test",
    });
    expect(
      await Audit.exists({
        action: "catalog.update",
        entityId: String(item._id),
      }),
    ).toBeTruthy();
    const invalid = await editAdminRecord(
      request({
        name: "catalog",
        id: String(item._id),
        patch: { key: "changed-key" },
      }),
    );
    expect(invalid.status).toBe(422);
  });

  it("updates reserved slot capacity without resubmitting or changing its dates", async () => {
    const zone = await Zone.create({
      name: "Modal test area",
      prefixes: ["E1"],
    });
    const start = new Date(Date.now() + 86400_000);
    const slot = await Slot.create({
      zoneId: zone._id,
      start,
      end: new Date(start.getTime() + 3600_000),
      capacity: 3,
      reservedCount: 1,
      active: true,
    });
    expect(
      (
        await editAdminRecord(
          request({
            name: "slots",
            id: String(slot._id),
            patch: { capacity: 4 },
          }),
        )
      ).status,
    ).toBe(200);
    expect((await Slot.findById(slot._id))?.start?.getTime()).toBe(
      start.getTime(),
    );
    expect(
      (
        await editAdminRecord(
          request({
            name: "slots",
            id: String(slot._id),
            patch: { start: new Date(start.getTime() + 1000).toISOString() },
          }),
        )
      ).status,
    ).toBe(409);
  });

  it("reports only permitted edits and keeps credentials out of user views", async () => {
    await User.updateOne(
      { _id: actor.id },
      {
        $set: {
          resetTokenHash: "private-reset-token",
          resetTokenExpiresAt: new Date(Date.now() + 3600_000),
        },
      },
    );
    const users = await adminCollections(
      new Request("https://example.test/api/admin/collections?name=users"),
    );
    const body = await users.json();
    expect(body.editableFields).toEqual([]);
    expect(JSON.stringify(body)).not.toContain("private-reset-token");
    expect(
      body.rows.every(
        (row: Record<string, unknown>) =>
          !("passwordHash" in row) && !("resetTokenHash" in row),
      ),
    ).toBe(true);
    actor.role = "dispatcher";
    const catalog = await adminCollections(
      new Request("https://example.test/api/admin/collections?name=catalog"),
    );
    expect((await catalog.json()).editableFields).toEqual([]);
    expect(
      (
        await editAdminRecord(
          request({
            name: "catalog",
            id: new mongoose.Types.ObjectId().toString(),
            patch: { title: "Forbidden edit" },
          }),
        )
      ).status,
    ).toBe(403);
  });
});

describe("transactional dispatch and settlement", () => {
  it("allows only one simultaneous offer and acceptance, with one payout ledger", async () => {
    const offers = await Promise.allSettled([offer(), offer()]);
    expect(
      offers.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const assignment = await Assignment.findOne({ live: true });
    expect(assignment).toBeTruthy();
    const accepts = await Promise.allSettled([
      acceptOffer(String(assignment!._id), driverId),
      acceptOffer(String(assignment!._id), driverId),
    ]);
    expect(
      accepts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await Payout.countDocuments({ assignmentId: assignment!._id })).toBe(
      1,
    );
    expect((await Booking.findById(bookingId))?.status).toBe("assigned");
  });
  it("rejects expired insurance and below-margin offers without mutating the job", async () => {
    await DriverApplication.updateOne(
      { userId: driverId },
      { $set: { insuranceExpiresAt: new Date(0) } },
    );
    await expect(offer()).rejects.toThrow("Driver is not approved");
    expect(await Assignment.countDocuments()).toBe(0);
    await DriverApplication.updateOne(
      { userId: driverId },
      { $set: { insuranceExpiresAt: new Date(Date.now() + 365 * 86400_000) } },
    );
    await OperationsPolicy.updateOne(
      {},
      { $set: { minimumMarginMinor: 5000 } },
    );
    await expect(offer()).rejects.toThrow("below the approved margin");
    expect((await Booking.findById(bookingId))?.assignmentId).toBeUndefined();
  });
  it("releases declined offers without deleting their pay history", async () => {
    const assignment = await offer();
    await releaseOffer(
      String(assignment._id),
      "rejected",
      driverId,
      "Unavailable",
    );
    expect((await Booking.findById(bookingId))?.assignmentId).toBeUndefined();
    expect((await Payout.findOne())?.offeredMinor).toBe(4000);
    expect((await Payout.findOne())?.status).toBe("held");
  });
  it("requires before/after pickup, a facility receipt, independent review and finance approval", async () => {
    const assignment = await offer();
    const id = String(assignment._id);
    await acceptOffer(id, driverId);
    const advance = async (
      status:
        | "en_route"
        | "arrived"
        | "collected"
        | "at_facility"
        | "evidence_submitted",
    ) => {
      const latest = await Assignment.findById(id);
      await advanceJob(id, driverId, status, "Test milestone", latest!.version);
    };
    await advance("en_route");
    await advance("arrived");
    await expect(advance("collected")).rejects.toThrow("before and after");
    const assets = await UploadAsset.create(
      ["before", "after", "receipt"].map((name) => ({
        publicId: `waste-well-placed/test/${name}`,
        ownerId: driverId,
        purpose: "evidence",
        mime: "image/jpeg",
      })),
    );
    await saveEvidence(id, driverId, {
      beforeAssetIds: [String(assets[0]._id)],
      afterAssetIds: [String(assets[1]._id)],
      receiptAssetId: String(assets[2]._id),
      receiptNumber: "TEST-RECEIPT",
      wasteDescription: "Mixed test waste",
      ewcCode: "TEST",
      weightKg: 180,
      deliveredAt: new Date().toISOString(),
    });
    await advance("collected");
    await advance("at_facility");
    await advance("evidence_submitted");
    const payout = await Payout.findOne();
    expect(
      (
        await settle(
          request({
            action: "approve",
            version: payout!.version,
            note: "Attempt before verification",
          }),
          { params: Promise.resolve({ id: String(payout!._id) }) },
        )
      ).status,
    ).toBe(422);
    const evidence = await Evidence.findOne();
    actor.role = "driver";
    actor.id = driverId;
    expect(
      (
        await verify(
          request({
            action: "verify",
            evidenceId: String(evidence!._id),
            approved: true,
            note: "Cannot approve own evidence",
          }),
          { params: Promise.resolve({ id: bookingId }) },
        )
      ).status,
    ).toBe(403);
    actor.role = "admin";
    actor.id = String((await User.findOne({ role: "admin" }))!._id);
    expect(
      (
        await verify(
          request({
            action: "verify",
            evidenceId: String(evidence!._id),
            approved: true,
            note: "Checked complete test evidence",
          }),
          { params: Promise.resolve({ id: bookingId }) },
        )
      ).status,
    ).toBe(200);
    expect((await Booking.findById(bookingId))?.status).toBe("verified");
    expect(
      (
        await settle(
          request({
            action: "approve",
            version: 0,
            note: "Test settlement approved",
          }),
          { params: Promise.resolve({ id: String(payout!._id) }) },
        )
      ).status,
    ).toBe(200);
    const body = {
      action: "paid",
      version: 1,
      note: "Test transfer completed",
      reference: "TEST-TRANSFER",
    };
    expect(
      (
        await settle(request(body), {
          params: Promise.resolve({ id: String(payout!._id) }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await settle(request(body), {
          params: Promise.resolve({ id: String(payout!._id) }),
        })
      ).status,
    ).toBe(409);
    expect(await Payout.countDocuments()).toBe(1);
    expect((await Booking.findById(bookingId))?.status).toBe("closed");
  });
});

describe("customer photo quotations and privacy", () => {
  it("links three private photos to one quote, prices it and creates only one booking on acceptance", async () => {
    const customer = await User.findOne({ role: "customer" });
    const staffId = actor.id;
    actor.id = String(customer!._id);
    actor.role = "customer";
    actor.email = customer!.email;
    const photos = await UploadAsset.create(
      [1, 2, 3].map((index) => ({
        publicId: `waste-well-placed/quote/test-${index}`,
        ownerId: customer!._id,
        purpose: "quote",
      })),
    );
    const response = await submitQuote(
      request({
        kind: "photo",
        name: "Test customer",
        email: customer!.email,
        phone: "+447123456789",
        type: "home",
        notes: "Three test images of mixed waste",
        photos: photos.map((asset) => ({
          publicId: asset.publicId,
          secureUrl: `/api/assets/${asset._id}`,
        })),
        consent: true,
      }),
    );
    expect(response.status).toBe(201);
    const result = await response.json();
    const quote = await Quote.findOne({ reference: result.reference });
    expect(quote!.photos).toHaveLength(3);
    expect(await UploadAsset.countDocuments({ quoteId: quote!._id })).toBe(3);
    actor.id = staffId;
    actor.role = "admin";
    const priced = await priceQuote(
      request({
        status: "awaiting_customer",
        version: 0,
        priceMinor: 10000,
        vatMinor: 2000,
        validUntil: new Date(Date.now() + 86400_000).toISOString(),
        lineItems: [{ description: "Collection", qty: 1, unitMinor: 10000 }],
        note: "Reviewed all three test photographs",
      }),
      { params: Promise.resolve({ id: String(quote!._id) }) },
    );
    expect(priced.status).toBe(200);
    const issued = await Notification.findOne({ event: "quote_issued" });
    const token = new URL(
      issued!.href!,
      "https://example.test",
    ).searchParams.get("token");
    actor.id = String(customer!._id);
    actor.role = "customer";
    actor.email = customer!.email;
    const zone = await Zone.create({
      name: "Test postcode zone",
      prefixes: ["SW1A"],
      active: true,
    });
    const slot = await Slot.create({
      zoneId: zone._id,
      start: new Date(Date.now() + 3600_000),
      capacity: 3,
      reservedCount: 1,
    });
    const hold = await Hold.create({
      slotId: slot._id,
      userId: customer!._id,
      expiresAt: new Date(Date.now() + 900_000),
    });
    const body = {
      action: "accept",
      version: 1,
      address: {
        line1: "Test street address",
        city: "London",
        postcode: "SW1A 1AA",
      },
      slotId: String(slot._id),
      holdId: String(hold._id),
    };
    const acceptanceRequest = () =>
      new Request(
        `https://example.test/api/quotes/${quote!._id}?token=${token}`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "https://example.test",
          },
          body: JSON.stringify(body),
        },
      );
    const decisions = await Promise.all([
      decideQuote(acceptanceRequest(), {
        params: Promise.resolve({ id: String(quote!._id) }),
      }),
      decideQuote(acceptanceRequest(), {
        params: Promise.resolve({ id: String(quote!._id) }),
      }),
    ]);
    expect(decisions.map((decision) => decision.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await Booking.countDocuments({ quoteId: quote!._id })).toBe(1);
    const booking = await Booking.findOne({ quoteId: quote!._id });
    expect(booking!.paymentStatus).toBe("pending");
    expect(booking!.price!.totalMinor).toBe(12000);
  });
  it("denies another customer access to private photos, and finance access to driver identity", async () => {
    const asset = await UploadAsset.create({
      publicId: "waste-well-placed/test/identity",
      ownerId: driverId,
      purpose: "driver_document",
    });
    actor.role = "finance";
    expect(
      (
        await privateAsset(new Request("https://example.test/api/assets"), {
          params: Promise.resolve({ id: String(asset._id) }),
        })
      ).status,
    ).toBe(403);
    actor.role = "customer";
    expect(
      (
        await privateAsset(new Request("https://example.test/api/assets"), {
          params: Promise.resolve({ id: String(asset._id) }),
        })
      ).status,
    ).toBe(403);
  });
  it("prevents human activation of underage and over-six-point applicants", async () => {
    const application = await DriverApplication.findOne({ userId: driverId });
    await DriverApplication.updateOne(
      { _id: application!._id },
      {
        $set: {
          status: "submitted",
          dateOfBirth: new Date(Date.now() - 18 * 365 * 86400_000),
        },
      },
    );
    const body = {
      status: "active",
      version: 0,
      note: "Test attempted activation",
      checks: {
        identity: true,
        licence: true,
        insurance: true,
        carrier: true,
        vehicle: true,
        contract: true,
      },
    };
    expect(
      (
        await reviewDriver(request(body), {
          params: Promise.resolve({ id: String(application!._id) }),
        })
      ).status,
    ).toBe(422);
    await DriverApplication.updateOne(
      { _id: application!._id },
      { $set: { dateOfBirth: new Date("1990-01-01"), points: 7 } },
    );
    expect(
      (
        await reviewDriver(request(body), {
          params: Promise.resolve({ id: String(application!._id) }),
        })
      ).status,
    ).toBe(422);
    expect((await DriverApplication.findById(application!._id))!.status).toBe(
      "submitted",
    );
  });
});

describe("Stripe event idempotency", () => {
  it("confirms payment once, queues one confirmation and never creates a payout from payment alone", async () => {
    await Booking.updateOne(
      { _id: bookingId },
      { $set: { paymentStatus: "pending", status: "pending_payment" } },
    );
    await Payment.create({
      bookingId,
      providerRef: "cs_test_confirm",
      amountMinor: 12000,
      status: "pending",
    });
    provider.event = {
      id: "evt_test_confirm",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_confirm",
          payment_status: "paid",
          amount_total: 12000,
          currency: "gbp",
          payment_intent: "pi_test_confirm",
          metadata: { bookingId },
        },
      },
    };
    const req = () =>
      new Request("https://example.test/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "synthetic-provider-signature" },
        body: "synthetic",
      });
    const results = await Promise.all([webhook(req()), webhook(req())]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect((await Booking.findById(bookingId))?.paymentStatus).toBe("paid");
    expect(
      await Audit.countDocuments({
        action: "payment.verified",
        entityId: bookingId,
      }),
    ).toBe(1);
    expect(
      await Notification.countDocuments({ event: "booking_confirmed" }),
    ).toBe(1);
    expect(await Payout.countDocuments()).toBe(0);
    provider.event = {
      id: "evt_test_refund",
      type: "charge.refunded",
      data: {
        object: {
          payment_intent: "pi_test_confirm",
          amount_refunded: 12000,
          refunded: true,
        },
      },
    };
    expect((await webhook(req())).status).toBe(200);
    expect((await webhook(req())).status).toBe(200);
    expect((await Booking.findById(bookingId))?.refundsMinor).toBe(12000);
    expect(await Audit.countDocuments({ action: "payment.refunded" })).toBe(1);
  });
});

describe("specialist load checkout", () => {
  it.each([
    ["construction-half", "construction", 26900, 350, 6.116],
    ["garden-full", "garden", 44900, 900, 12.233],
  ])(
    "preserves %s classification and server pricing",
    async (loadKey, wasteType, subtotal, weight, volume) => {
      const customer = await User.findOne({ role: "customer" });
      actor.id = String(customer!._id);
      actor.role = "customer";
      const zone = await Zone.create({
        name: "Specialist test zone",
        prefixes: ["SW1A"],
        active: true,
      });
      const slot = await Slot.create({
        zoneId: zone._id,
        start: new Date(Date.now() + 3600_000),
        capacity: 3,
        reservedCount: 1,
      });
      const hold = await Hold.create({
        slotId: slot._id,
        userId: customer!._id,
        expiresAt: new Date(Date.now() + 900_000),
      });
      const response = await createBooking(
        request({
          kind: "load",
          postcode: "SW1A 1AA",
          loadKey,
          address: {
            line1: "10 Test Street",
            city: "London",
            postcode: "SW1A 1AA",
          },
          slotId: String(slot._id),
          holdId: String(hold._id),
          idempotencyKey: crypto.randomUUID(),
        }),
      );
      expect(response.status).toBe(201);
      const result = await response.json();
      const saved = await Booking.findById(result.bookingId);
      expect(saved).toMatchObject({
        loadKey,
        wasteType,
        expectedWeightKg: weight,
        expectedVolumeM3: volume,
      });
      expect(saved?.price?.subtotalMinor).toBe(subtotal);
      expect((await Hold.findById(hold._id))?.status).toBe("consumed");
    },
  );
});

describe("passwordless driver applications and approval access", () => {
  const start = {
    name: "New applicant",
    email: "new-driver@example.test",
    phone: "07123456789",
    basedIn: "London",
    postcode: "E1 6AN",
    hasFullUkLicence: true,
    ownsVan: false,
  };
  const reviewChecks = {
    identity: true,
    licence: true,
    insurance: true,
    carrier: true,
    vehicle: true,
    contract: true,
  };
  async function approvePendingDriver() {
    await User.updateOne(
      { _id: driverId },
      { $set: { driverPasswordPending: true } },
    );
    const app = await DriverApplication.findOne({ userId: driverId });
    await DriverApplication.updateOne(
      { _id: app!._id },
      {
        $set: {
          status: "submitted",
          hasFullUkLicence: true,
          documents: [
            "identity",
            "licence",
            "insurance",
            "carrier",
            "vehicle_front",
            "vehicle_side",
            "vehicle_load",
            "mot",
          ].map((kind, index) => ({
            kind,
            assetId: String(index + 1).repeat(24),
          })),
        },
      },
    );
    const result = await reviewDriver(
      request({
        status: "active",
        version: 0,
        note: "All original evidence reviewed",
        checks: reviewChecks,
      }),
      { params: Promise.resolve({ id: String(app!._id) }) },
    );
    expect(result.status).toBe(200);
    const email = await Notification.findOne({
      event: "driver_password_setup",
      recipientId: driverId,
    });
    expect(email).toBeTruthy();
    return new URL(email!.href!, "https://example.test").searchParams.get(
      "token",
    )!;
  }
  it("starts without a password, saves eligibility/location, and sends a single-use application link", async () => {
    createdSession.mockClear();
    const response = await registerDriver(
      request({ ...start, password: "BrowserPasswordIsIgnored" }),
    );
    expect(response.status).toBe(201);
    const user = await User.findOne({ email: start.email });
    expect(user?.driverPasswordPending).toBe(true);
    expect(
      await bcrypt.compare("BrowserPasswordIsIgnored", user!.passwordHash),
    ).toBe(false);
    const app = await DriverApplication.findOne({ userId: user!._id });
    expect(app).toMatchObject({
      hasFullUkLicence: true,
      ownsVan: false,
      basedIn: "London",
    });
    const email = await Notification.findOne({
      recipientId: user!._id,
      event: "driver_application_access",
    });
    const token = new URL(
      email!.href!,
      "https://example.test",
    ).searchParams.get("token")!;
    expect(user?.driverAccessTokenHash).toBeUndefined();
    expect(
      (await driverAccess(request({ token, purpose: "application" }))).status,
    ).toBe(200);
    expect(
      (await driverAccess(request({ token, purpose: "application" }))).status,
    ).toBe(422);
    expect(createdSession).toHaveBeenLastCalledWith({
      id: String(user!._id),
      role: "driver",
      applicationOnly: true,
    });
  });
  it("rejects applicants without a full UK licence on the server", async () => {
    expect(
      (await registerDriver(request({ ...start, hasFullUkLicence: false })))
        .status,
    ).toBe(422);
    expect(await User.exists({ email: start.email })).toBeNull();
  });
  it("queues password setup only after approval and consumes the token atomically", async () => {
    const token = await approvePendingDriver();
    const pending = await User.findById(driverId).select(
      "+driverAccessTokenHash",
    );
    expect(pending!.driverAccessTokenHash).toBe(hashToken(token));
    const body = {
      token,
      purpose: "password_setup",
      password: "NewApprovedPassword123!",
    };
    const results = await Promise.all([
      driverAccess(request(body)),
      driverAccess(request(body)),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 422]);
    const saved = await User.findById(driverId).select(
      "+driverAccessTokenHash",
    );
    expect(saved!.driverPasswordPending).toBe(false);
    expect(saved!.driverAccessTokenHash).toBeUndefined();
    expect(await bcrypt.compare(body.password, saved!.passwordHash)).toBe(true);
    expect(createdSession).toHaveBeenLastCalledWith({
      id: driverId,
      role: "driver",
      applicationOnly: false,
    });
  });
  it("refuses expired setup links and links revoked by suspension", async () => {
    const token = await approvePendingDriver();
    await User.updateOne(
      { _id: driverId },
      { $set: { driverAccessExpiresAt: new Date(Date.now() - 1000) } },
    );
    const body = {
      token,
      purpose: "password_setup",
      password: "NewApprovedPassword123!",
    };
    expect((await driverAccess(request(body))).status).toBe(422);
    await User.updateOne(
      { _id: driverId },
      { $set: { driverAccessExpiresAt: new Date(Date.now() + 3600_000) } },
    );
    await DriverApplication.updateOne(
      { userId: driverId },
      { $set: { status: "suspended" } },
    );
    expect((await driverAccess(request(body))).status).toBe(422);
    expect((await User.findById(driverId))!.driverPasswordPending).toBe(true);
  });
  it("returns the same public response for unknown and pending application email addresses", async () => {
    await registerDriver(request(start));
    const known = await requestDriverAccess(request({ email: start.email }));
    const unknown = await requestDriverAccess(
      request({ email: "not-registered@example.test" }),
    );
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await known.json()).toEqual(await unknown.json());
  });
});

describe("audit regression fixes", () => {
  async function owner() {
    const user = await User.findOne({ email: "customer@example.test" });
    actor.id = String(user!._id);
    actor.role = "customer";
    return user!;
  }
  async function staff() {
    const user = await User.findOne({ role: "admin" });
    actor.id = String(user!._id);
    actor.role = "admin";
    return user!;
  }
  async function reservation() {
    const user = await owner();
    const zone = await Zone.create({
      name: "Audit zone",
      prefixes: ["SW1A"],
      active: true,
    });
    const slot = await Slot.create({
      zoneId: zone._id,
      start: new Date(Date.now() + 3600_000),
      end: new Date(Date.now() + 7200_000),
      capacity: 1,
      reservedCount: 1,
    });
    const hold = await Hold.create({
      userId: user._id,
      slotId: slot._id,
      expiresAt: new Date(Date.now() + 900_000),
    });
    return { user, zone, slot, hold };
  }
  it("uses edited catalog and load prices, and refuses disabled items", async () => {
    await Catalog.create({
      key: "chair",
      title: "Updated chair",
      category: "Furniture",
      priceMinor: 12345,
      active: true,
    });
    const data = {
      kind: "items" as const,
      postcode: "SW1A 1AA",
      items: [{ key: "chair", qty: 1 }],
      stairs: false,
      longCarry: false,
      specialHandling: false,
    };
    expect((await quotePrice(data)).subtotalMinor).toBe(12345);
    await Catalog.updateOne({ key: "chair" }, { $set: { active: false } });
    await expect(quotePrice(data)).rejects.toThrow("Unknown item");
    await Tariff.create({
      key: "garden-full",
      title: "Garden full load",
      priceMinor: 49900,
    });
    expect(
      (
        await quotePrice({
          kind: "load",
          postcode: "SW1A 1AA",
          loadKey: "garden-full",
          stairs: false,
          longCarry: false,
          specialHandling: false,
        })
      ).subtotalMinor,
    ).toBe(49900);
  });
  it("uses owner-approved VAT treatment instead of an assumed tax status", async () => {
    await CompanyProfile.create({
      key: "company",
      approved: true,
      vatRegistered: false,
    });
    expect(
      (
        await quotePrice({
          kind: "load",
          postcode: "SW1A 1AA",
          loadKey: "mini",
          stairs: false,
          longCarry: false,
          specialHandling: false,
        })
      ).vatMinor,
    ).toBe(0);
  });
  it("recovers capacity after an old TTL index removed the expired hold", async () => {
    const { slot, hold } = await reservation();
    await Hold.deleteOne({ _id: hold._id });
    await releaseExpiredHolds();
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(0);
  });
  it("allows only one concurrent reservation of the final slot", async () => {
    const { slot, hold } = await reservation();
    await Hold.deleteOne({ _id: hold._id });
    await Slot.updateOne({ _id: slot._id }, { $set: { reservedCount: 0 } });
    const responses = await Promise.all([
      reserveSlot(request({ slotId: String(slot._id) })),
      reserveSlot(request({ slotId: String(slot._id) })),
    ]);
    expect(responses.map((row) => row.status).sort()).toEqual([201, 409]);
    expect(await Hold.countDocuments({ status: "active" })).toBe(1);
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(1);
  });
  it("rejects reuse of a checkout key for a different order", async () => {
    const { slot, hold } = await reservation();
    const data = {
      kind: "load",
      postcode: "SW1A 1AA",
      loadKey: "mini",
      address: {
        line1: "10 Test Street",
        city: "London",
        postcode: "SW1A 1AA",
      },
      slotId: String(slot._id),
      holdId: String(hold._id),
      idempotencyKey: crypto.randomUUID(),
    };
    expect((await createBooking(request(data))).status).toBe(201);
    expect((await createBooking(request(data))).status).toBe(200);
    expect(
      (await createBooking(request({ ...data, loadKey: "xl" }))).status,
    ).toBe(409);
  });
  it("expires unpaid bookings and holds late payments for staff review without overselling", async () => {
    const { slot, hold } = await reservation();
    await Hold.updateOne({ _id: hold._id }, { $set: { status: "consumed" } });
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          slotId: slot._id,
          holdId: hold._id,
          status: "pending_payment",
          paymentStatus: "pending",
          checkoutExpiresAt: new Date(Date.now() - 1000),
        },
      },
    );
    await Payment.create({
      bookingId,
      providerRef: "cs_late_test",
      amountMinor: 12000,
      status: "pending",
    });
    await releaseExpiredHolds();
    expect((await Booking.findById(bookingId))!.status).toBe("expired");
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(0);
    provider.event = {
      id: "evt_late_test",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_late_test",
          metadata: { bookingId },
          payment_status: "paid",
          currency: "gbp",
          amount_total: 12000,
          payment_intent: "pi_late_test",
        },
      },
    };
    const response = await webhook(
      new Request("https://example.test/api/payments/webhook", {
        method: "POST",
        headers: { "stripe-signature": "test" },
        body: "signed test event",
      }),
    );
    expect(response.status).toBe(200);
    expect((await Booking.findById(bookingId))!.status).toBe("payment_review");
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(0);
  });
  it("makes cancellation a staff-reviewed action and releases capacity exactly once", async () => {
    const { slot, hold } = await reservation();
    await Hold.deleteOne({ _id: hold._id });
    await Booking.updateOne({ _id: bookingId }, { $set: { slotId: slot._id } });
    expect(
      (
        await requestChange(
          request({ kind: "cancel", reason: "Plans changed, please review" }),
          { params: Promise.resolve({ id: bookingId }) },
        )
      ).status,
    ).toBe(201);
    expect((await Booking.findById(bookingId))!.status).toBe("confirmed");
    const change = await BookingChange.findOne({ bookingId });
    await staff();
    const body = {
      action: "review",
      requestId: String(change!._id),
      approved: true,
      note: "Cancellation reviewed and approved",
    };
    expect(
      (
        await reviewChange(request(body), {
          params: Promise.resolve({ id: bookingId }),
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await reviewChange(request(body), {
          params: Promise.resolve({ id: bookingId }),
        })
      ).status,
    ).toBe(409);
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(0);
    expect(await RefundRequest.countDocuments()).toBe(0);
  });
  it("moves a paid booking to a new slot atomically after staff approval", async () => {
    const { zone, slot, hold } = await reservation();
    await Hold.deleteOne({ _id: hold._id });
    const next = await Slot.create({
      zoneId: zone._id,
      start: new Date(Date.now() + 86400_000),
      end: new Date(Date.now() + 90000_000),
      capacity: 1,
    });
    await Booking.updateOne({ _id: bookingId }, { $set: { slotId: slot._id } });
    await requestChange(
      request({
        kind: "reschedule",
        reason: "A later collection is needed",
        preferredDate: new Date(Date.now() + 86400_000)
          .toISOString()
          .slice(0, 10),
      }),
      { params: Promise.resolve({ id: bookingId }) },
    );
    const change = await BookingChange.findOne({ bookingId });
    await staff();
    expect(
      (
        await reviewChange(
          request({
            action: "review",
            requestId: String(change!._id),
            approved: true,
            slotId: String(next._id),
            note: "New collection time agreed",
          }),
          { params: Promise.resolve({ id: bookingId }) },
        )
      ).status,
    ).toBe(200);
    expect(String((await Booking.findById(bookingId))!.slotId)).toBe(
      String(next._id),
    );
    expect((await Slot.findById(slot._id))!.reservedCount).toBe(0);
    expect((await Slot.findById(next._id))!.reservedCount).toBe(1);
  });
  it("prevents concurrent over-refunds and sends the approved refund once", async () => {
    await Payment.create({
      bookingId,
      providerRef: "cs_refund_test",
      providerIntentId: "pi_refund_test",
      amountMinor: 12000,
      status: "paid",
    });
    const body = {
      action: "refund",
      amountMinor: 10000,
      note: "Approved partial customer refund",
    };
    const responses = await Promise.all([
      reviewChange(request(body), {
        params: Promise.resolve({ id: bookingId }),
      }),
      reviewChange(request(body), {
        params: Promise.resolve({ id: bookingId }),
      }),
    ]);
    expect(responses.map((row) => row.status).sort()).toEqual([200, 422]);
    expect(await RefundRequest.countDocuments()).toBe(1);
    process.env.STRIPE_SECRET_KEY = "isolated-test-only";
    provider.refund.mockResolvedValue({ id: "re_test", charge: "ch_test" });
    provider.charge.mockResolvedValue({
      amount_refunded: 10000,
      refunded: false,
      refunds: { data: [{ id: "re_test", status: "succeeded" }] },
    });
    expect(await processRefunds()).toBe(1);
    expect(await processRefunds()).toBe(0);
    expect(provider.refund).toHaveBeenCalledTimes(1);
    expect((await Booking.findById(bookingId))!.refundsMinor).toBe(10000);
    expect((await RefundRequest.findOne())!.status).toBe("confirmed");
  });
  it("issues one immutable invoice for a verified payment", async () => {
    await CompanyProfile.create({
      key: "company",
      legalName: "Test Company",
      address: "10 Test Street",
      vatNumber: "TEST-VAT",
      approved: true,
    });
    const responses = await Promise.all([
      issueInvoice(request({}), { params: Promise.resolve({ id: bookingId }) }),
      issueInvoice(request({}), { params: Promise.resolve({ id: bookingId }) }),
    ]);
    expect(responses.map((row) => row.status)).toEqual([200, 200]);
    expect(await Invoice.countDocuments()).toBe(1);
    expect((await Invoice.findOne())!.number).toMatch(/^INV-\d{4}-000001$/);
  });
  it("consumes customer password reset links once and invalidates old session versions", async () => {
    const user = await User.findOne({ role: "customer" });
    expect((await forgotPassword(request({ email: user!.email }))).status).toBe(
      200,
    );
    const email = await Notification.findOne({ event: "password_reset" });
    const token = new URL(
      email!.href!,
      "https://example.test",
    ).searchParams.get("token");
    const data = { token, password: "ResetApprovedPassword123!" };
    const results = await Promise.all([
      resetPassword(request(data)),
      resetPassword(request(data)),
    ]);
    expect(results.map((row) => row.status).sort()).toEqual([200, 422]);
    const saved = await User.findById(user!._id);
    expect(saved!.sessionVersion).toBe(1);
    expect(await bcrypt.compare(data.password, saved!.passwordHash)).toBe(true);
  });
  it("lets reviewers assign company vehicle evidence without bypassing activation checks", async () => {
    const reviewer = actor.id;
    const app = await DriverApplication.findOne({ userId: driverId });
    const required = ["identity", "licence", "carrier"];
    const own = await UploadAsset.create(
      required.map((kind) => ({
        publicId: `driver/${kind}`,
        ownerId: driverId,
        purpose: "driver_document",
      })),
    );
    await DriverApplication.updateOne(
      { _id: app!._id },
      {
        $set: {
          ownsVan: false,
          status: "submitted",
          hasFullUkLicence: true,
          documents: own.map((asset, index) => ({
            kind: required[index],
            assetId: asset._id,
          })),
        },
      },
    );
    const kinds = [
      "insurance",
      "mot",
      "vehicle_front",
      "vehicle_side",
      "vehicle_load",
    ];
    const assets = await UploadAsset.create(
      kinds.map((kind) => ({
        publicId: `company/${kind}`,
        ownerId: reviewer,
        purpose: "driver_document",
      })),
    );
    const expiry = new Date(Date.now() + 365 * 86400_000)
      .toISOString()
      .slice(0, 10);
    const body = {
      version: 0,
      vehicleRegistration: "TEST123",
      vehicleMakeModel: "Test Transit",
      vehicleClass: "Van",
      vanSize: "Large van",
      maximumWeightKg: 3500,
      capacityKg: 1000,
      capacityM3: 16,
      insuranceExpiresAt: expiry,
      motExpiresAt: expiry,
      vehicleTaxConfirmed: true,
      note: "Company vehicle checked and assigned",
      documents: assets.map((asset, index) => ({
        kind: kinds[index],
        assetId: String(asset._id),
      })),
    };
    expect(
      (
        await companyVehicle(request(body), {
          params: Promise.resolve({ id: String(app!._id) }),
        })
      ).status,
    ).toBe(200);
    const saved = await DriverApplication.findById(app!._id);
    expect(saved!.documents).toHaveLength(8);
    expect(saved!.checks?.vehicle).toBe(false);
    expect(
      (await UploadAsset.findById(assets[0]._id))!.ownerId?.toString(),
    ).toBe(driverId);
  });
  it("onboards businesses and scopes collection reports to their organisation", async () => {
    const response = await onboardBusiness(
      request({
        name: "Audit business",
        legalName: "Audit Business Ltd",
        managerName: "Test customer",
        managerEmail: "customer@example.test",
        billingEmail: "billing@example.test",
      }),
    );
    expect(response.status).toBe(201);
    const org = await Organization.findOne({ name: "Audit business" });
    const user = await owner();
    actor.role = "business";
    actor.organizationId = String(org!._id);
    await Booking.updateOne(
      { _id: bookingId },
      {
        $set: {
          organizationId: org!._id,
          status: "verified",
          scheduledAt: new Date(),
        },
      },
    );
    const result = await report(
      new Request("https://example.test/api/business/reports"),
    );
    expect(result.status).toBe(200);
    expect((await result.json()).summary.collections).toBe(1);
    expect((await User.findById(user._id))!.organizationId?.toString()).toBe(
      String(org!._id),
    );
  });
  it("reconciles an unknown provider result only when it matches the approved refund", async () => {
    await Payment.create({
      bookingId,
      providerRef: "cs_manual_refund",
      providerIntentId: "pi_manual_refund",
      amountMinor: 12000,
      status: "paid",
    });
    const item = await RefundRequest.create({
      bookingId,
      requestedBy: actor.id,
      amountMinor: 3000,
      reason: "Manual reconciliation test",
      status: "review",
    });
    const body = {
      action: "reconcile_refund",
      requestId: String(item._id),
      providerRef: "re_manual_test",
    };
    provider.refundLookup.mockResolvedValue({
      id: body.providerRef,
      amount: 3000,
      payment_intent: "pi_manual_refund",
      charge: "ch_manual",
      status: "succeeded",
      metadata: { refundRequestId: "wrong-request" },
    });
    expect(
      (
        await reviewChange(request(body), {
          params: Promise.resolve({ id: bookingId }),
        })
      ).status,
    ).toBe(422);
    provider.refundLookup.mockResolvedValue({
      id: body.providerRef,
      amount: 3000,
      payment_intent: "pi_manual_refund",
      charge: "ch_manual",
      status: "succeeded",
      metadata: { refundRequestId: String(item._id) },
    });
    provider.charge.mockResolvedValue({
      amount_refunded: 3000,
      refunded: false,
    });
    expect(
      (
        await reviewChange(request(body), {
          params: Promise.resolve({ id: bookingId }),
        })
      ).status,
    ).toBe(200);
    expect((await RefundRequest.findById(item._id))!.status).toBe("confirmed");
    expect((await Booking.findById(bookingId))!.refundsMinor).toBe(3000);
    expect(provider.refund).not.toHaveBeenCalled();
  });
  it("keeps approved tax treatment stable while company policy drafts are edited", async () => {
    await CompanyProfile.create({
      key: "company",
      approved: false,
      vatRegistered: true,
      vatRate: 0.2,
      approvedTax: {
        vatRegistered: false,
        vatRate: 0,
        pricesIncludeVat: false,
      },
    });
    const quote = await quotePrice({
      kind: "load",
      postcode: "SW1A 1AA",
      loadKey: "mini",
      stairs: false,
      longCarry: false,
      specialHandling: false,
    });
    expect(quote.vatMinor).toBe(0);
    expect(quote.totalMinor).toBe(5900);
  });
});
