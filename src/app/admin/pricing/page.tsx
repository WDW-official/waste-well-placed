import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Load price book"
      name="tariffs"
      fields={["key", "title", "priceMinor", "active"]}
      editable={true}
    />
  );
}
