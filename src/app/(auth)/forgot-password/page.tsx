import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Reset Password | Grove",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
