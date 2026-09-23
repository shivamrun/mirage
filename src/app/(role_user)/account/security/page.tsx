import { AccountSecurityPage } from "@/features/account/components";
import { isGoogleAuthConfigured } from "@/features/auth/better-auth/server";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Security", {
  path: "/account/security",
});

type AccountSecurityRoutePageProps = {
  searchParams: Promise<{
    googleAccount?: string;
  }>;
};

export default async function Page({
  searchParams,
}: AccountSecurityRoutePageProps) {
  const { googleAccount } = await searchParams;

  return (
    <AccountSecurityPage
      googleAccountStatus={googleAccount}
      googleAuthEnabled={isGoogleAuthConfigured}
    />
  );
}
