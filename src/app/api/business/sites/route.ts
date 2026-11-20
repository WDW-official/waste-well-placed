import { z } from "zod";
import { businessContext } from "@/lib/business";
import { requireCondition } from "@/lib/operations/security";
import { Organization } from "@/lib/models";
import { postcode } from "@/lib/validation";
import { audit } from "@/lib/operations/events";
import { connectDB } from "@/lib/db";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function GET() {
  try {
    const { user, organization } = await businessContext();
    return ok({
      organization: {
        id: String(organization._id),
        name: organization.name,
        billingEmail: organization.billingEmail,
        sites: organization.sites,
      },
      canEdit: String(organization.managerId) === user.id,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const { user, organization } = await businessContext();
    requireCondition(
      String(organization.managerId) === user.id,
      "Only the organisation manager can change collection sites",
      403,
    );
    const data = z
      .object({
        billingEmail: z.string().email().max(254),
        sites: z
          .array(
            z.object({
              name: z.string().trim().min(2).max(150),
              address: z.string().trim().min(5).max(1000),
              postcode,
            }),
          )
          .max(50),
      })
      .strict()
      .parse(await req.json());
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      await Organization.updateOne(
        { _id: organization._id, managerId: user.id },
        { $set: data },
        { session },
      );
      await audit(
        user.id,
        "business.sites_updated",
        String(organization._id),
        {},
        session,
      );
    });
    return ok({ updated: true });
  } catch (error) {
    return errorResponse(error);
  }
}
