import { AdminResource } from "@/components/admin-resource";
export default function Page() {
  return (
    <AdminResource
      title="Appointment slots"
      name="slots"
      fields={["start", "end", "capacity", "reservedCount", "active"]}
      editable={true}
    />
  );
}
