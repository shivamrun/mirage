import type { Metadata } from "next";

import AuthContainer from "@/components/auth/auth-container";
import { EmailChangeConfirmation } from "@/components/auth/email-change-confirmation";

export const metadata: Metadata = {
  title: "Confirm Email Change | Grove",
};

type EmailChangePageProps = {
  searchParams: Promise<{
    action?: string;
    status?: string;
    token?: string;
  }>;
};

export default async function EmailChangePage({
  searchParams,
}: EmailChangePageProps) {
  const { action, status, token } = await searchParams;

  return (
    <AuthContainer
      authForm={
        <EmailChangeConfirmation
          action={action === "approve" ? "approve" : "confirm"}
          status={status}
          token={token}
        />
      }
    />
  );
}
