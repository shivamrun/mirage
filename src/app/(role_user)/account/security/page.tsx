import { AccountSecurityPage } from "@/components/account";
import { isGoogleAuthConfigured } from "@/lib/auth";
import { getPageMetadata } from "@/lib/metadata";

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
