import { ForgotPasswordForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Reset Password", {
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return <AuthContainer authForm={<ForgotPasswordForm />} />;
}
