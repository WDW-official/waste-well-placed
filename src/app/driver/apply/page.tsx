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
      subtitle="Save your progress and return when your documents are ready. Every application is reviewed by a person."
    >
      {!user ? (
        <DriverAccess register />
      ) : user.role === "driver" ? (
        <DriverApplicationForm />
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
