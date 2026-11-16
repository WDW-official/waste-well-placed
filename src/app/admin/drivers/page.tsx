import { OperationsLayout } from "@/components/operations-layout";
import { OperationsDashboard } from "@/components/operations-dashboard";
export default function Page() {
  return (
    <OperationsLayout title="Driver applications">
      <OperationsDashboard view="drivers" />
    </OperationsLayout>
  );
}
