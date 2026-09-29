import { AccountReferralsPage } from "@/features/account/components";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Referrals", {
  path: "/account/referrals",
});

export default function Page() {
  return <AccountReferralsPage />;
}
