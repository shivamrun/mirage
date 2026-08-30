import AuthContainer from "@/components/auth/auth-container";
import { EmailChangeConfirmation } from "@/components/auth/email-change-confirmation";
import { getPageMetadata } from "@/lib/metadata";

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
