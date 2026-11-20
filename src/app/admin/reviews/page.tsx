import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Customer review moderation"
      name="reviews"
      fields={["name", "rating", "text", "approved"]}
      editable
    />
  );
}
