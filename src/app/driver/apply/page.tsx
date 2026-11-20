import { getSession } from "@/lib/auth";
import { PlatformShell } from "@/components/platform-shell";
import { DriverAccess } from "@/components/driver-access";
import { DriverApplicationForm } from "@/components/driver-application-form";
import Link from "next/link";
export default async function Apply() {
  const user = await getSession();
  return (
    <PlatformShell
      title="Apply to drive with us"
      subtitle="Apply first, without a password. Every application is reviewed by our team; approved drivers receive an email link to set their password."
    >
      {!user ? (
        <DriverAccess register />
      ) : user.role === "driver" ? (
        <DriverApplicationForm passwordPending={user.driverPasswordPending} />
      ) : (
        <div className="platform-card">
          <p>
            You are signed in with a customer or staff account. Use a separate
            driver account to apply.
          </p>
          <Link className="btn btn-outline mt-4" href="/account">
            Go to your account to sign out
          </Link>
        </div>
      )}
    </PlatformShell>
  );
}
