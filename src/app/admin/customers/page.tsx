import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Customers"
      name="users"
      fields={["name", "email", "role", "createdAt"]}
      editable={false}
    />
  );
}
