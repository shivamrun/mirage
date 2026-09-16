import { EmailVerificationStatus } from "@/features/auth/components";
import AuthContainer from "@/features/auth/components/auth-container";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Verify Email", {
  path: "/email-verification",
});

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
