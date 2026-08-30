import type { Metadata } from "next";

import { AccountPage } from "@/components/account";
import { isGoogleAuthConfigured } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Account | Mirage",
};

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
