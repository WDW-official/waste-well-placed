import { OperationsLayout } from "@/components/operations-layout";
import { JobCockpit } from "@/components/job-cockpit";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <OperationsLayout title="Collection record">
      <JobCockpit id={(await params).id} />
    </OperationsLayout>
  );
}
