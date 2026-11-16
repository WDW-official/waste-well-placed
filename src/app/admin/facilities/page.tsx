import { OperationsLayout } from "@/components/operations-layout";
import { FacilityManager } from "@/components/facility-manager";
export default function Facilities() {
  return (
    <OperationsLayout title="Receiving facilities">
      <FacilityManager />
    </OperationsLayout>
  );
}
