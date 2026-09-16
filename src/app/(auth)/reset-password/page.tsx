import { ResetPasswordForm } from "@/features/auth/components";
import AuthContainer from "@/features/auth/components/auth-container";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Choose New Password", {
  path: "/reset-password",
});

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
