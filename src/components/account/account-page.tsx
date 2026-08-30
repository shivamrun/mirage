"use client";

import { LockKeyhole, LogOut, MailCheck, Plug, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AccountConnectedAccounts } from "@/components/account/account-connected-accounts";
import { AccountEmailManager } from "@/components/account/account-email-manager";
import { AccountPasswordForm } from "@/components/account/account-password-form";
import { AccountProfileForm } from "@/components/account/account-profile-form";
import { AccountSection } from "@/components/account/account-section";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { siteConfig } from "@/lib/metadata";

function AccountPage({
  emailChangeStatus,
  googleAuthEnabled,
  googleAccountStatus,
}: {
  emailChangeStatus?: string;
  googleAuthEnabled?: boolean;
  googleAccountStatus?: string;
}) {
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user;
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  React.useEffect(() => {
    if (!session.isPending && !user) {
      router.replace("/login");
    }
  }, [router, session.isPending, user]);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  if (session.isPending || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center px-6">
        <p className="text-muted-foreground text-sm">Loading account...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              href={siteConfig.links.home}
              className="link-text font-semibold text-lg"
            >
              {siteConfig.name}
            </Link>
            <h1 className="font-semibold text-3xl">Account</h1>
            <p className="text-muted-foreground text-sm">{user.email}</p>
          </div>
          <Button
            disabled={isSigningOut}
            onClick={signOut}
            type="button"
            variant="outline"
          >
            <LogOut data-icon="inline-start" />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </Button>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="flex flex-col gap-6">
            <AccountSection
              description={`Update the public details tied to your ${siteConfig.name} account.`}
              icon={<User />}
              title="Profile"
            >
              <AccountProfileForm
                onSessionRefresh={session.refetch}
                user={user}
              />
            </AccountSection>

            <AccountSection
              description="Change your password and keep this session active."
              icon={<LockKeyhole />}
              title="Security"
            >
              <AccountPasswordForm />
            </AccountSection>
          </div>

          <aside className="flex flex-col gap-6">
            <AccountSection
              description="View your current address, send a verification link, or change it."
              icon={<MailCheck />}
              title="Email"
            >
              <AccountEmailManager
                emailChangeStatus={emailChangeStatus}
                onSessionRefresh={session.refetch}
                user={user}
              />
            </AccountSection>

            <AccountSection
              description="Connect a Google account for sign-in, or disconnect it when needed."
              icon={<Plug />}
              title="Connected accounts"
            >
              <AccountConnectedAccounts
                googleAuthEnabled={googleAuthEnabled}
                googleAccountStatus={googleAccountStatus}
              />
            </AccountSection>
          </aside>
        </div>
      </div>
    </main>
  );
}

export { AccountPage };
