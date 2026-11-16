import { PlatformShell } from "@/components/platform-shell";
import { DriverAccess } from "@/components/driver-access";
export default function DriverLogin() {
  return (
    <PlatformShell
      title="Driver sign in"
      subtitle="Your application, collections and earnings in one place."
    >
      <DriverAccess />
    </PlatformShell>
  );
}
