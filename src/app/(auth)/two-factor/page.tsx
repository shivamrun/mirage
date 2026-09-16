import { TwoFactorForm } from "@/features/auth/components";
import AuthContainer from "@/features/auth/components/auth-container";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Two-Factor Authentication", {
  path: "/two-factor",
});

type TwoFactorPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

export default async function TwoFactorPage({
  searchParams,
}: TwoFactorPageProps) {
  const { callbackURL } = await searchParams;

  return (
    <AuthContainer
      authForm={<TwoFactorForm redirectTo={getSafeAuthRedirect(callbackURL)} />}
    />
  );
}
