import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth";

export const metadata: Metadata = {
  title: "Choose New Password | Grove",
};

type ResetPasswordPageProps = {
  searchParams: Promise<{
    error?: string;
    token?: string;
  }>;
};

export default async function ResetPasswordPage({
  searchParams,
}: ResetPasswordPageProps) {
  const { error, token } = await searchParams;

  return <ResetPasswordForm error={error} token={token} />;
}
