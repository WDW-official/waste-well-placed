import { z } from "zod";
import { CompanyProfile } from "@/lib/workflow-models";
import { connectDB } from "@/lib/db";
import { requireUser, requireCondition } from "@/lib/operations/security";
import { backoffice, permitted } from "@/lib/operations/policy";
import { audit } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
function configuration() {
  return Object.fromEntries(
    [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "DRIVER_DATA_KEY",
      "CRON_SECRET",
      "RESEND_API_KEY",
      "NOTIFICATION_FROM_EMAIL",
      "NEXT_PUBLIC_SITE_URL",
    ].map((key) => [key, !!process.env[key]]),
  );
}
export async function GET() {
  try {
    const user = await requireUser();
    requireCondition(backoffice(user.role), "Not permitted", 403);
    await connectDB();
    return ok({
      company: await CompanyProfile.findOne({ key: "company" }).lean(),
      canEdit: permitted(user.role, "policy"),
      configuration: configuration(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const user = await requireUser("policy");
    const data = z
      .object({
        legalName: z.string().trim().max(200),
        address: z.string().trim().max(1000),
        companyNumber: z.string().trim().max(100),
        vatNumber: z.string().trim().max(100),
        carrierNumber: z.string().trim().max(100),
        email: z.union([z.string().trim().email(), z.literal("")]),
        phone: z.string().max(30),
        vatRegistered: z.boolean(),
        vatRate: z.number().min(0).max(1),
        pricesIncludeVat: z.boolean(),
        cancellationPolicy: z.string().max(30000),
        privacyText: z.string().max(100000),
        termsText: z.string().max(100000),
        approved: z.boolean(),
      })
      .strict()
      .parse(await req.json());
    if (data.approved) {
      requireCondition(
        data.legalName.length >= 2 &&
          data.address.length >= 5 &&
          data.email &&
          data.phone,
        "Complete company contact details before publishing",
      );
      requireCondition(
        data.cancellationPolicy.length >= 30 &&
          data.privacyText.length >= 100 &&
          data.termsText.length >= 100,
        "Add approved policies before publishing",
      );
      if (data.vatRegistered)
        requireCondition(data.vatNumber, "Enter the VAT registration number");
    }
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      await CompanyProfile.updateOne(
        { key: "company" },
        {
          $set: {
            ...data,
            ...(data.approved
              ? {
                  approvedTax: {
                    vatRegistered: data.vatRegistered,
                    vatRate: data.vatRate,
                    pricesIncludeVat: data.pricesIncludeVat,
                  },
                }
              : {}),
            approvedBy: user.id,
            approvedAt: data.approved ? new Date() : null,
          },
        },
        { upsert: true, session },
      );
      await audit(
        user.id,
        "company.profile_updated",
        "company",
        { approved: data.approved },
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
