import { redirect } from "next/navigation";
import { getCheckoutIntent } from "@/features/pricing/checkout-intent";
import { CheckoutResume } from "@/features/pricing/components/checkout-resume";
import { requireAuth } from "@/server/db/services/auth/access";
import { getPageMetadata } from "@/shared/metadata";

export const metadata = getPageMetadata("Checkout", {
  path: "/checkout",
});

type CheckoutPageProps = {
  searchParams: Promise<{
    interval?: string;
    plan?: string;
  }>;
};

export default async function CheckoutPage({
  searchParams,
}: CheckoutPageProps) {
  const params = await searchParams;
  const intent = getCheckoutIntent(params);

  if (!intent) {
    redirect("/pricing");
  }

  await requireAuth({
    callbackUrl: `/checkout?${new URLSearchParams({
      interval: intent.interval,
      plan: intent.plan,
    })}`,
  });

  return (
    <CheckoutResume interval={intent.interval} planName={intent.planName} />
  );
}
