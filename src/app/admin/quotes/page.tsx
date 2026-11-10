import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Photo quotations"
      name="quotes"
      fields={["reference", "status", "priceMinor", "totalMinor", "createdAt"]}
      editable={false}
    />
  );
}
