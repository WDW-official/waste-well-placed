import { OperationsLayout } from "@/components/operations-layout";
import { CompanySettings } from "@/components/company-settings";
export default function Settings() {
  return (
    <OperationsLayout title="Company & launch settings">
      <CompanySettings />
    </OperationsLayout>
  );
}
