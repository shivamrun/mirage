import { ForgotPasswordForm } from "@/features/auth/components";
import AuthContainer from "@/features/auth/components/auth-container";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Reset Password", {
  path: "/forgot-password",
});

export default function ForgotPasswordPage() {
  return <AuthContainer authForm={<ForgotPasswordForm />} />;
}
