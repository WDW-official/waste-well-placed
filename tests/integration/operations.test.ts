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
const provider = vi.hoisted(() => ({ event: null as unknown }));
vi.mock("@/lib/stripe", () => ({
  stripeClient: () => ({ webhooks: { constructEvent: () => provider.event } }),
}));
const actor = vi.hoisted(() => ({
  id: "",
  role: "admin",
  email: "ops@example.test",
  name: "Test operator",
  organizationId: null,
}));
vi.mock("@/lib/auth", () => ({ getSession: vi.fn(async () => actor) }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined })),
}));
import { connectDB } from "@/lib/db";
import {
  Booking,
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
let replica: MongoMemoryReplSet;
let driverId: string;
let bookingId: string;
let facilityId: string;
const models: Model<unknown>[] = [
  Booking,
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
    ["construction-half", "construction", 15900, 350, 6.116],
    ["garden-full", "garden", 31900, 900, 12.233],
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
