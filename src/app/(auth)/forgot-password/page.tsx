import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";

export const metadata: Metadata = {
  title: "Reset Password | Mirage",
};

export default function ForgotPasswordPage() {
  return <AuthContainer authForm={<ForgotPasswordForm />} />;
}
