import { z } from "zod";
import bcrypt from "bcryptjs";
import { Organization, User } from "@/lib/models";
import { connectDB } from "@/lib/db";
import {
  requireUser,
  requireCondition,
  hashToken,
  newToken,
} from "@/lib/operations/security";
import { audit, notify } from "@/lib/operations/events";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function GET() {
  try {
    const user = await requireUser("operations");
    await connectDB();
    return ok({
      canCreate: ["admin", "superadmin"].includes(user.role),
      organizations: await Organization.find({})
        .populate("managerId", "name email")
        .sort({ createdAt: -1 })
        .limit(100)
        .lean(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const staff = await requireUser("operations");
    requireCondition(
      ["admin", "superadmin"].includes(staff.role),
      "Administrator access required",
      403,
    );
    const data = z
      .object({
        name: z.string().trim().min(2).max(200),
        legalName: z.string().trim().min(2).max(200),
        managerName: z.string().trim().min(2).max(100),
        managerEmail: z.string().trim().email().toLowerCase(),
        billingEmail: z.string().trim().email(),
      })
      .parse(await req.json());
    const passwordHash = await bcrypt.hash(newToken(), 12);
    const db = await connectDB();
    await db.connection.transaction(async (session) => {
      let manager = await User.findOne({ email: data.managerEmail }).session(
        session,
      );
      requireCondition(
        !manager || ["customer", "business"].includes(manager.role),
        "Use a customer or business account as the organisation manager",
      );
      requireCondition(
        !manager?.organizationId,
        "This account already belongs to an organisation",
      );
      let created = false;
      if (!manager) {
        [manager] = await User.create(
          [
            {
              name: data.managerName,
              email: data.managerEmail,
              passwordHash,
              role: "business",
            },
          ],
          { session },
        );
        created = true;
      }
      const [org] = await Organization.create(
        [
          {
            name: data.name,
            legalName: data.legalName,
            managerId: manager._id,
            billingEmail: data.billingEmail,
            sites: [],
          },
        ],
        { session },
      );
      await User.updateOne(
        { _id: manager._id },
        { $set: { role: "business", organizationId: org._id } },
        { session },
      );
      if (created) {
        const token = newToken();
        await User.updateOne(
          { _id: manager._id },
          {
            $set: {
              resetTokenHash: hashToken(token),
              resetTokenExpiresAt: new Date(Date.now() + 3600_000),
            },
          },
          { session },
        );
        await notify(
          {
            key: `business-invite:${org._id}`,
            event: "business_invitation",
            reference: String(org._id),
            recipientId: String(manager._id),
            email: data.managerEmail,
            subject: "Your business account is ready",
            message:
              "Your organisation has been added. Choose a password using this one-time link, then sign in to manage collection sites and bookings.",
            href: `/reset-password?token=${token}`,
          },
          session,
        );
      } else
        await notify(
          {
            key: `business-onboarding:${org._id}`,
            event: "business_onboarding",
            reference: String(org._id),
            recipientId: String(manager._id),
            subject: "Your business workspace is ready",
            message:
              "Your account is linked to your organisation. You can manage collection sites and view business bookings.",
            href: "/portal",
          },
          session,
        );
      await audit(staff.id, "business.created", String(org._id), {}, session);
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
