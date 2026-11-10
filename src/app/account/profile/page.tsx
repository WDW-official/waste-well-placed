import { getSession } from "@/lib/auth";
import { DashLayout } from "@/components/dash-layout";
import { LogoutButton } from "@/components/logout-button";
export default async function Profile() {
  const u = await getSession();
  return (
    <DashLayout
      type="My account"
      title="My profile"
      links={[
        { name: "Overview", href: "/account" },
        { name: "Bookings", href: "/account/bookings" },
        { name: "Documents", href: "/account/documents" },
        { name: "Profile", href: "/account/profile" },
      ]}
    >
      <div className="card p-7 max-w-xl">
        <p>
          <strong>Name:</strong> {u?.name}
        </p>
        <p className="mt-3">
          <strong>Email:</strong> {u?.email}
        </p>
        <p className="mt-3">
          <strong>Account type:</strong> {u?.role}
        </p>
        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </DashLayout>
  );
}
