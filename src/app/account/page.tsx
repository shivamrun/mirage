import { AccountPage } from "@/components/account";
import { isGoogleAuthConfigured } from "@/lib/auth";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Account", { path: "/account" });

type AccountRoutePageProps = {
  searchParams: Promise<{
    emailChange?: string;
    googleAccount?: string;
  }>;
};

export default async function Page({ searchParams }: AccountRoutePageProps) {
  const { emailChange, googleAccount } = await searchParams;

  return (
    <AccountPage
      emailChangeStatus={emailChange}
      googleAuthEnabled={isGoogleAuthConfigured}
      googleAccountStatus={googleAccount}
    />
  );
}
