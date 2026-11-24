import { AccessPage } from "@/components/access-page";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Log in" };
export default function Login() {
  return (
    <AccessPage>
      <AuthForm mode="login" />
    </AccessPage>
  );
}
