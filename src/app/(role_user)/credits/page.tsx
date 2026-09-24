import { CreditLabPage } from "@/features/credits/components";
import { requireAuth } from "@/server/db/services/auth/access";
import { getCreditBalance } from "@/server/db/services/credits/ledger";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Credit Lab", {
  path: "/credits",
});

export default async function Page() {
  const user = await requireAuth({
    callbackUrl: "/credits",
  });
  const balance = await getCreditBalance(user.id);

  return <CreditLabPage balance={balance} />;
}
