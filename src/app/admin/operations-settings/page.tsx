import { OperationsLayout } from "@/components/operations-layout";
import { OperationsSettings } from "@/components/operations-settings";
export default function Settings() {
  return (
    <OperationsLayout title="Operational policy">
      <OperationsSettings />
    </OperationsLayout>
  );
}
