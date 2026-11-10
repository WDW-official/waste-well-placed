import { PageTitle } from "@/components/page-title";
import { AuthForm } from "@/components/auth-form";
export const metadata = { title: "Log in" };
export default function Login() {
  return (
    <>
      <PageTitle title="Welcome back" />
      <div className="container section">
        <AuthForm mode="login" />
      </div>
    </>
  );
}
