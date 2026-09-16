import AuthContainer from "@/features/auth/components/auth-container";
import { EmailChangeConfirmation } from "@/features/auth/components/email-change-confirmation";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Confirm Email Change", {
  path: "/email-change",
});

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
