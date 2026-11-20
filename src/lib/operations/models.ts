import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";
const ref = (name: string) => ({ type: Schema.Types.ObjectId, ref: name });
const timestamps = { timestamps: true };
const DriverApplicationSchema = new Schema(
  {
    userId: { ...ref("User"), required: true, unique: true },
    status: {
      type: String,
      enum: [
        "draft",
        "submitted",
        "driving_review",
        "vehicle_review",
        "compliance_review",
        "more_information",
        "approved",
        "rejected",
        "active",
        "suspended",
        "expired",
      ],
      default: "draft",
    },
    legalName: String,
    dateOfBirth: Date,
    phone: String,
    postcode: String,
    basedIn: String,
    hasFullUkLicence: Boolean,
    ownsVan: Boolean,
    vanSize: String,
    licenceCountry: String,
    licenceCategories: [String],
    yearsHeld: Number,
    licenceLastEight: { type: String, select: false },
    dvlaCheckCode: { type: String, select: false },
    points: Number,
    disqualified: Boolean,
    endorsements: String,
    licenceExpiresAt: Date,
    vehicleRegistration: String,
    vehicleMakeModel: String,
    vehicleClass: String,
    maximumWeightKg: Number,
    capacityKg: Number,
    capacityM3: Number,
    insuranceExpiresAt: Date,
    motExpiresAt: Date,
    vehicleTaxConfirmed: Boolean,
    carrierReference: String,
    carrierRelationship: String,
    carrierExpiresAt: Date,
    coveragePrefixes: [String],
    wasteTypes: [String],
    workModel: String,
    availableDays: [Number],
    availableFrom: String,
    availableUntil: String,
    online: { type: Boolean, default: false },
    availableUntilAt: Date,
    consents: {
      privacy: Boolean,
      checks: Boolean,
      safety: Boolean,
      contract: Boolean,
    },
    checks: {
      identity: Boolean,
      licence: Boolean,
      insurance: Boolean,
      carrier: Boolean,
      vehicle: Boolean,
      contract: Boolean,
    },
    documents: [{ kind: String, assetId: ref("UploadAsset"), expiresAt: Date }],
    draft: Schema.Types.Mixed,
    reviewNotes: String,
    reviewedBy: ref("User"),
    reviewedAt: Date,
    submittedAt: Date,
    version: { type: Number, default: 0 },
  },
  timestamps,
);
const FacilitySchema = new Schema(
  {
    name: { type: String, required: true },
    address: String,
    postcode: String,
    permitReference: { type: String, required: true },
    wasteTypes: [String],
    verifiedBy: ref("User"),
    checkedAt: Date,
    expiresAt: Date,
    active: { type: Boolean, default: false },
    chargeMinor: Number,
  },
  timestamps,
);
const AssignmentSchema = new Schema(
  {
    bookingId: { ...ref("Booking"), required: true },
    driverId: { ...ref("User"), required: true },
    facilityId: { ...ref("Facility"), required: true },
    status: {
      type: String,
      enum: [
        "offered",
        "accepted",
        "rejected",
        "timed_out",
        "active",
        "evidence_submitted",
        "approved",
        "disputed",
        "cancelled",
      ],
      default: "offered",
    },
    live: { type: Boolean, default: true },
    expiresAt: Date,
    acceptedAt: Date,
    // Immutable after offer creation; adjustments live in a separate ledger.
    offerMinor: { type: Number, required: true, immutable: true },
    economics: { type: Schema.Types.Mixed, immutable: true },
    policyVersion: { type: Number, immutable: true },
    offeredBy: ref("User"),
    reason: String,
    version: { type: Number, default: 0 },
  },
  timestamps,
);
AssignmentSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { live: true } },
);
AssignmentSchema.index(
  { driverId: 1 },
  { unique: true, partialFilterExpression: { live: true } },
);
const EvidenceSchema = new Schema(
  {
    assignmentId: { ...ref("Assignment"), required: true, unique: true },
    bookingId: ref("Booking"),
    driverId: ref("User"),
    beforeAssetIds: [{ type: Schema.Types.ObjectId, ref: "UploadAsset" }],
    afterAssetIds: [{ type: Schema.Types.ObjectId, ref: "UploadAsset" }],
    receiptAssetId: ref("UploadAsset"),
    facilityId: ref("Facility"),
    receiptNumber: String,
    wasteDescription: String,
    ewcCode: String,
    weightKg: Number,
    deliveredAt: Date,
    submittedAt: Date,
    status: {
      type: String,
      enum: ["draft", "submitted", "rejected", "verified"],
      default: "draft",
    },
    verificationNote: String,
    verifierId: ref("User"),
    verifiedAt: Date,
    transferNoteAssetId: ref("UploadAsset"),
  },
  timestamps,
);
const PayoutSchema = new Schema(
  {
    assignmentId: { ...ref("Assignment"), required: true, unique: true },
    driverId: ref("User"),
    bookingId: ref("Booking"),
    offeredMinor: { type: Number, immutable: true, required: true },
    adjustments: [
      { amountMinor: Number, reason: String, actorId: String, at: Date },
    ],
    status: {
      type: String,
      enum: [
        "estimated",
        "conditional",
        "approved",
        "scheduled",
        "paid",
        "held",
      ],
      default: "estimated",
    },
    approvedBy: ref("User"),
    approvedAt: Date,
    paidBy: ref("User"),
    paidAt: Date,
    scheduledAt: Date,
    transferReference: String,
    holdReason: String,
    version: { type: Number, default: 0 },
  },
  timestamps,
);
const UploadAssetSchema = new Schema(
  {
    publicId: { type: String, required: true, unique: true },
    format: String,
    resourceType: String,
    purpose: {
      type: String,
      enum: ["quote", "driver_document", "evidence", "transfer_note"],
      required: true,
    },
    ownerId: ref("User"),
    guestId: String,
    bookingId: ref("Booking"),
    quoteId: ref("Quote"),
    originalName: String,
    mime: String,
    bytes: Number,
    deletedAt: Date,
  },
  timestamps,
);
const NotificationSchema = new Schema(
  {
    key: { type: String, unique: true, required: true },
    recipientId: ref("User"),
    email: String,
    event: String,
    reference: String,
    subject: String,
    message: String,
    href: String,
    templateVersion: { type: Number, default: 1 },
    status: {
      type: String,
      enum: ["pending", "sending", "sent", "failed"],
      default: "pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    lockedAt: Date,
    sentAt: Date,
    readAt: Date,
  },
  timestamps,
);
const PolicySchema = new Schema(
  {
    key: { type: String, unique: true, default: "operations" },
    version: { type: Number, default: 1 },
    minAge: { type: Number, default: 21 },
    maxPoints: { type: Number, default: 6 },
    minimumMarginMinor: { type: Number, default: 0 },
    approved: { type: Boolean, default: false },
    approvedBy: ref("User"),
    approvedAt: Date,
    driverPayMode: {
      type: String,
      enum: ["fixed", "percentage"],
      default: "fixed",
    },
    driverRateBps: { type: Number, default: 0 },
  },
  timestamps,
);
const IssueSchema = new Schema(
  {
    bookingId: ref("Booking"),
    ownerId: ref("User"),
    openedBy: ref("User"),
    kind: String,
    note: String,
    status: { type: String, enum: ["open", "resolved"], default: "open" },
    dueAt: Date,
    resolution: String,
    customerApprovalReference: String,
    resolvedBy: ref("User"),
    resolvedAt: Date,
  },
  timestamps,
);
export const DriverApplication =
  (models.DriverApplication as
    Model<InferSchemaType<typeof DriverApplicationSchema>> | undefined) ||
  model("DriverApplication", DriverApplicationSchema);
export const Facility =
  (models.Facility as
    Model<InferSchemaType<typeof FacilitySchema>> | undefined) ||
  model("Facility", FacilitySchema);
export const Assignment =
  (models.Assignment as
    Model<InferSchemaType<typeof AssignmentSchema>> | undefined) ||
  model("Assignment", AssignmentSchema);
export const Evidence =
  (models.Evidence as
    Model<InferSchemaType<typeof EvidenceSchema>> | undefined) ||
  model("Evidence", EvidenceSchema);
export const Payout =
  (models.Payout as Model<InferSchemaType<typeof PayoutSchema>> | undefined) ||
  model("Payout", PayoutSchema);
export const UploadAsset =
  (models.UploadAsset as
    Model<InferSchemaType<typeof UploadAssetSchema>> | undefined) ||
  model("UploadAsset", UploadAssetSchema);
export const Notification =
  (models.Notification as
    Model<InferSchemaType<typeof NotificationSchema>> | undefined) ||
  model("Notification", NotificationSchema);
export const OperationsPolicy =
  (models.OperationsPolicy as
    Model<InferSchemaType<typeof PolicySchema>> | undefined) ||
  model("OperationsPolicy", PolicySchema);
export const Issue =
  (models.Issue as Model<InferSchemaType<typeof IssueSchema>> | undefined) ||
  model("Issue", IssueSchema);
const RateLimitSchema = new Schema({
  key: { type: String, unique: true, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
RateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const RateLimit: Model<InferSchemaType<typeof RateLimitSchema>> =
  (models.RateLimit as
    Model<InferSchemaType<typeof RateLimitSchema>> | undefined) ||
  model("RateLimit", RateLimitSchema);
const ProviderEventSchema = new Schema({
  eventId: { type: String, required: true, unique: true },
  type: String,
  createdAt: { type: Date, default: Date.now },
});
export const ProviderEvent: Model<InferSchemaType<typeof ProviderEventSchema>> =
  (models.ProviderEvent as
    Model<InferSchemaType<typeof ProviderEventSchema>> | undefined) ||
  model("ProviderEvent", ProviderEventSchema);
