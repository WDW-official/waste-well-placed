import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Service areas"
      name="zones"
      fields={["name", "prefixes", "surchargeMinor", "active"]}
      editable={true}
    />
  );
}
