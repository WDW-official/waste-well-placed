import { OperationsLayout } from "@/components/operations-layout";
import { BusinessManager } from "@/components/business-manager";
export default function Page() {
  return (
    <OperationsLayout title="Business organisations">
      <BusinessManager />
    </OperationsLayout>
  );
}
