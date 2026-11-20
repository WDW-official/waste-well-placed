import { PasswordRecovery } from "@/components/password-recovery";
export const metadata = {
  title: "Reset your password",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
export default async function Reset({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <div className="container section max-w-lg">
      <PasswordRecovery token={token || undefined} />
    </div>
  );
}
