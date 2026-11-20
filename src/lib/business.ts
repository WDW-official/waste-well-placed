import { getSession } from "./auth";
import { connectDB } from "./db";
import { Organization } from "./models";
import { requireCondition } from "./operations/security";
export async function businessContext() {
  const user = await getSession();
  requireCondition(
    user && ["business", "admin", "superadmin"].includes(user.role),
    "Business account required",
    403,
  );
  requireCondition(
    user.organizationId,
    "Your organisation has not been linked",
    409,
  );
  await connectDB();
  const organization = await Organization.findById(user.organizationId);
  requireCondition(organization, "Organisation not found", 404);
  return { user, organization };
}
export function csvCell(value: unknown) {
  const text = String(value ?? "");
  return `"${(/^[=+\-@\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""')}"`;
}
