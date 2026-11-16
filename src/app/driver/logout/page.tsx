import { PlatformShell } from "@/components/platform-shell";
import { LogoutButton } from "@/components/logout-button";
export default function DriverLogout() {
  return (
    <PlatformShell title="Sign out">
      <LogoutButton />
    </PlatformShell>
  );
}
