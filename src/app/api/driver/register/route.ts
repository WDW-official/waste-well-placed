import { rateLimit } from "@/lib/operations/rate-limit";
import bcrypt from "bcryptjs";
import { driverRegistrationSchema } from "@/lib/operations/validation";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { DriverApplication } from "@/lib/operations/models";
import { createSession } from "@/lib/auth";
import { audit } from "@/lib/operations/events";
import { queueDriverAccess } from "@/lib/operations/driver-access";
import { newToken } from "@/lib/operations/security";
import { ensureSameOrigin, errorResponse, fail, ok } from "@/lib/http";
export async function POST(req: Request) {
  if (!ensureSameOrigin(req)) return fail("Invalid origin", 403);
  try {
    const data = driverRegistrationSchema.parse(await req.json());
    const db = await connectDB();
    await rateLimit(req, "driver-register", 5);
    if (await User.exists({ email: data.email }))
      return fail(
        "This email is already registered. Sign in or request an application access link.",
        409,
      );
    const passwordHash = await bcrypt.hash(newToken(), 12);
    const user = await db.connection.transaction(async (session) => {
      const [created] = await User.create(
        [
          {
            name: data.name,
            email: data.email,
            phone: data.phone,
            passwordHash,
            driverPasswordPending: true,
            role: "driver",
          },
        ],
        { session },
      );
      await DriverApplication.create(
        [
          {
            userId: created._id,
            legalName: data.name,
            phone: data.phone,
            basedIn: data.basedIn,
            postcode: data.postcode,
            hasFullUkLicence: data.hasFullUkLicence,
            ownsVan: data.ownsVan,
            vehicleMakeModel: data.ownsVan ? data.vehicleMakeModel : undefined,
            vanSize: data.ownsVan ? data.vanSize : undefined,
            draft: {
              legalName: data.name,
              phone: data.phone,
              basedIn: data.basedIn,
              postcode: data.postcode,
              hasFullUkLicence: true,
              ownsVan: data.ownsVan,
              vehicleMakeModel: data.ownsVan
                ? data.vehicleMakeModel
                : undefined,
              vanSize: data.ownsVan ? data.vanSize : undefined,
              workModel: data.ownsVan ? "own_vehicle" : "company_vehicle",
            },
          },
        ],
        { session },
      );
      await audit(
        String(created._id),
        "driver.account_created",
        String(created._id),
        {},
        session,
      );
      await queueDriverAccess(
        String(created._id),
        created.email,
        "application",
        session,
      );
      return created;
    });
    await createSession({
      id: String(user._id),
      role: "driver",
      applicationOnly: true,
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
