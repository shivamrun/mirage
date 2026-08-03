import type { Metadata } from "next";

import { AccountPage } from "@/components/account";

export const metadata: Metadata = {
  title: "Account | Grove",
};

type AccountRoutePageProps = {
  searchParams: Promise<{
    emailChange?: string;
  }>;
};

export default async function Page({ searchParams }: AccountRoutePageProps) {
  const { emailChange } = await searchParams;

  return <AccountPage emailChangeStatus={emailChange} />;
}
