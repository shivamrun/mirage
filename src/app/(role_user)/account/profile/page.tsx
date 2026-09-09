import { AccountProfilePage } from "@/components/account";
import { getPageMetadata } from "@/lib/metadata";

export const metadata = getPageMetadata("Update profile", {
  path: "/account/profile",
});

type AccountProfileRoutePageProps = {
  searchParams: Promise<{
    emailChange?: string;
  }>;
};

export default async function Page({
  searchParams,
}: AccountProfileRoutePageProps) {
  const { emailChange } = await searchParams;

  return <AccountProfilePage emailChangeStatus={emailChange} />;
}
