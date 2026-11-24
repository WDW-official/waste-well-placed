import { AccessPage } from "@/components/access-page";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Create account" };
export default function Register() {
  return (
    <AccessPage>
      <AuthForm mode="register" />
    </AccessPage>
  );
}
