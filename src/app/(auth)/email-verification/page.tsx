import type { Metadata } from "next";

import { EmailVerificationStatus } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";

export const metadata: Metadata = {
  title: "Verify Email | Mirage",
};

type EmailVerificationPageProps = {
  searchParams: Promise<{
    error?: string;
    status?: string;
  }>;
};

export default async function EmailVerificationPage({
  searchParams,
}: EmailVerificationPageProps) {
  const { error, status } = await searchParams;

  return (
    <AuthContainer
      authForm={<EmailVerificationStatus error={error} status={status} />}
    />
  );
}
