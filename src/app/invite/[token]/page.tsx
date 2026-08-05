import type { Metadata } from "next";

import { InviteActivation } from "@/components/auth";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";

export const metadata: Metadata = {
  title: "Creator Invite | Grove",
};

type InvitePageProps = {
  params: Promise<{
    token: string;
  }>;
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

export default async function InvitePage({
  params,
  searchParams,
}: InvitePageProps) {
  const { token } = await params;
  const { callbackURL } = await searchParams;
  const safeCallbackURL = getSafeAuthRedirect(callbackURL);

  return <InviteActivation callbackURL={safeCallbackURL} token={token} />;
}
