import type { Metadata } from "next";

import { EmailVerificationStatus } from "@/components/auth";

export const metadata: Metadata = {
  title: "Verify Email | Grove",
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

  return <EmailVerificationStatus error={error} status={status} />;
}
