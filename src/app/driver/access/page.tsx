import { PlatformShell } from "@/components/platform-shell";
import { DriverAccessLink } from "@/components/driver-access-link";

export default async function DriverAccessPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; purpose?: string }>;
}) {
  const params = await searchParams;
  return (
    <PlatformShell
      title="Your driver application"
      subtitle="Secure access to your application and approved driver account."
    >
      <DriverAccessLink
        token={params.token ?? ""}
        purpose={params.purpose ?? ""}
      />
    </PlatformShell>
  );
}
