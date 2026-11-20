import { PageTitle } from "@/components/page-title";
import { PasswordRecovery } from "@/components/password-recovery";
export default function Forgot() {
  return (
    <>
      <PageTitle title="Account recovery" />
      <div className="container section max-w-lg">
        <PasswordRecovery />
      </div>
    </>
  );
}
