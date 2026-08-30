import { ResetPasswordForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";
import { getPageMetadata } from "@/lib/metadata";

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
