import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";

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

  return (
    <AuthContainer
      authForm={<ResetPasswordForm error={error} token={token} />}
    />
  );
}
