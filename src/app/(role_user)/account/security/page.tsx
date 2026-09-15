import { AccountSecurityPage } from "@/components/account";
import { getPageMetadata } from "@/lib/metadata";
import { isGoogleAuthConfigured } from "@/server/auth/better-auth";

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
