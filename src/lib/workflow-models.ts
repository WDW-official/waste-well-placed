import {
  Schema,
  model,
  models,
  type Model,
  type InferSchemaType,
} from "mongoose";
const ref = (name: string) => ({ type: Schema.Types.ObjectId, ref: name });
const TariffSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    priceMinor: { type: Number, required: true, min: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);
const ChangeSchema = new Schema(
  {
    bookingId: { ...ref("Booking"), required: true },
    userId: { ...ref("User"), required: true },
    kind: { type: String, enum: ["cancel", "reschedule"], required: true },
    reason: { type: String, required: true },
    preferredDate: String,
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    reviewedBy: ref("User"),
    reviewedAt: Date,
    reviewNote: String,
  },
  { timestamps: true },
);
ChangeSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);
const RefundSchema = new Schema(
  {
    bookingId: { ...ref("Booking"), required: true },
    requestedBy: { ...ref("User"), required: true },
    amountMinor: { type: Number, required: true },
    reason: String,
    status: {
      type: String,
      enum: ["queued", "sending", "submitted", "confirmed", "failed", "review"],
      default: "queued",
    },
    providerRef: String,
    failure: String,
    attempts: { type: Number, default: 0 },
    lockedAt: Date,
    nextAttemptAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);
const CompanySchema = new Schema(
  {
    key: { type: String, unique: true, default: "company" },
    legalName: String,
    address: String,
    companyNumber: String,
    vatNumber: String,
    vatRegistered: { type: Boolean, default: false },
    vatRate: { type: Number, default: 0.2 },
    pricesIncludeVat: { type: Boolean, default: false },
    approvedTax: {
      vatRegistered: Boolean,
      vatRate: Number,
      pricesIncludeVat: Boolean,
    },
    carrierNumber: String,
    email: String,
    phone: String,
    cancellationPolicy: String,
    privacyText: String,
    termsText: String,
    approved: { type: Boolean, default: false },
    approvedBy: ref("User"),
    approvedAt: Date,
  },
  { timestamps: true },
);
const InvoiceSchema = new Schema(
  {
    bookingId: { ...ref("Booking"), required: true, unique: true },
    userId: { ...ref("User"), required: true },
    organizationId: ref("Organization"),
    number: { type: String, required: true, unique: true },
    issuedAt: { type: Date, default: Date.now },
    company: {
      legalName: String,
      address: String,
      companyNumber: String,
      vatNumber: String,
    },
    customer: { name: String, address: String },
    lines: [{ title: String, qty: Number, unitMinor: Number }],
    totalMinor: Number,
    vatMinor: Number,
    issuedBy: ref("User"),
  },
  { timestamps: true },
);
const ReviewSchema = new Schema(
  {
    bookingId: { ...ref("Booking"), required: true, unique: true },
    userId: { ...ref("User"), required: true },
    name: String,
    rating: { type: Number, min: 1, max: 5, required: true },
    text: { type: String, required: true },
    approved: { type: Boolean, default: false },
    publicationConsentAt: Date,
    reviewedBy: ref("User"),
    reviewedAt: Date,
  },
  { timestamps: true },
);
export const Tariff =
  (models.Tariff as Model<InferSchemaType<typeof TariffSchema>> | undefined) ||
  model("Tariff", TariffSchema);
export const BookingChange =
  (models.BookingChange as
    Model<InferSchemaType<typeof ChangeSchema>> | undefined) ||
  model("BookingChange", ChangeSchema);
export const RefundRequest =
  (models.RefundRequest as
    Model<InferSchemaType<typeof RefundSchema>> | undefined) ||
  model("RefundRequest", RefundSchema);
export const CompanyProfile =
  (models.CompanyProfile as
    Model<InferSchemaType<typeof CompanySchema>> | undefined) ||
  model("CompanyProfile", CompanySchema);
export const Invoice =
  (models.Invoice as
    Model<InferSchemaType<typeof InvoiceSchema>> | undefined) ||
  model("Invoice", InvoiceSchema);
export const Review =
  (models.Review as Model<InferSchemaType<typeof ReviewSchema>> | undefined) ||
  model("Review", ReviewSchema);

const CounterSchema = new Schema({
  key: { type: String, unique: true, required: true },
  value: { type: Number, default: 0 },
});
export const Counter: Model<InferSchemaType<typeof CounterSchema>> =
  (models.Counter as
    Model<InferSchemaType<typeof CounterSchema>> | undefined) ||
  model("Counter", CounterSchema);
