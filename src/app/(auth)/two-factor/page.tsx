import { TwoFactorForm } from "@/components/auth";
import AuthContainer from "@/components/auth/auth-container";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";
import { getPageMetadata } from "@/lib/metadata";

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
