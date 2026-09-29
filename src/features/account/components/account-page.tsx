"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { HeadingBlock } from "@/components/heading-block";
import { Button } from "@/components/ui/button";
import { AccountConnectedAccounts } from "@/features/account/components/account-connected-accounts";
import { AccountEmailManager } from "@/features/account/components/account-email-manager";
import { AccountImpersonationNotice } from "@/features/account/components/account-impersonation-notice";
import { AccountPasswordForm } from "@/features/account/components/account-password-form";
import { AccountProfileForm } from "@/features/account/components/account-profile-form";
import {
  AccountSection,
  AccountSectionStack,
} from "@/features/account/components/account-section";
import { AccountTwoFactorForm } from "@/features/account/components/account-two-factor-form";
import { authClient } from "@/features/auth/better-auth/client";

type ImpersonatedSessionData = {
  session?: {
    impersonatedBy?: null | string;
  };
};

type AccountUser = NonNullable<
  ReturnType<typeof authClient.useSession>["data"]
>["user"];

type AccountPageShellProps = {
  children: (context: {
    onSessionRefresh: () => Promise<void>;
    user: AccountUser;
  }) => React.ReactNode;
  description: string;
  title: string;
};

function AccountPageShell({
  children,
  description,
  title,
}: AccountPageShellProps) {
  const router = useRouter();
  const session = authClient.useSession();
  const user = session.data?.user;
  const impersonatedBy = (session.data as ImpersonatedSessionData | null)
    ?.session?.impersonatedBy;

  React.useEffect(() => {
    if (!session.isPending && !user) {
      router.replace("/login");
    }
  }, [router, session.isPending, user]);

  if (session.isPending || !user) {
    return <main className="h-full min-h-0 px-6" aria-busy="true" />;
  }

  return (
    <main className="w-full">
      <div className="mx-auto flex w-full max-w-5xl pt-6 pb-14 flex-col gap-6">
        <HeadingBlock
          as="header"
          className="px-6 py-4"
          description={description}
          size="xl"
          title={title}
          titleAs="h1"
        />

        <AccountImpersonationNotice impersonatedBy={impersonatedBy} />

        {children({
          onSessionRefresh: session.refetch,
          user,
        })}
      </div>
    </main>
  );
}

function AccountProfilePage({
  emailChangeStatus,
}: {
  emailChangeStatus?: string;
}) {
  return (
    <AccountPageShell
      description="Manage your profile details and email preferences."
      title="Profile"
    >
      {({ onSessionRefresh, user }) => (
        <AccountSectionStack>
          <AccountSection
            description="Update the name and profile image shown on your account."
            title="Personal details"
          >
            <AccountProfileForm
              onSessionRefresh={onSessionRefresh}
              user={user}
            />
          </AccountSection>

          <AccountSection
            description="Verify or change the address used for account notifications."
            title="Email"
          >
            <AccountEmailManager
              emailChangeStatus={emailChangeStatus}
              onSessionRefresh={onSessionRefresh}
              user={user}
            />
          </AccountSection>
        </AccountSectionStack>
      )}
    </AccountPageShell>
  );
}

function AccountSecurityPage({
  googleAccountStatus,
  googleAuthEnabled,
}: {
  googleAccountStatus?: string;
  googleAuthEnabled?: boolean;
}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = React.useState(false);

  async function signOut() {
    setIsSigningOut(true);

    try {
      await authClient.signOut();
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <AccountPageShell
      title="Security"
      description="Keep your sign-in methods current and control this browser session."
    >
      {({ onSessionRefresh, user }) => (
        <AccountSectionStack>
          <AccountSection
            title="Update Password"
            description="Update your password while keeping this session active."
          >
            <AccountPasswordForm />
          </AccountSection>

          <AccountSection
            description="Require a time-based code from an authenticator app after password sign-in."
            title="Authenticator app"
          >
            <AccountTwoFactorForm
              onSessionRefresh={onSessionRefresh}
              user={user}
            />
          </AccountSection>

          <AccountSection
            title="Linked Accounts"
            description="Manage Google as an additional sign-in method."
          >
            <AccountConnectedAccounts
              googleAuthEnabled={googleAuthEnabled}
              googleAccountStatus={googleAccountStatus}
            />
          </AccountSection>

          <AccountSection title="Sessions">
            <div className="flex items-center justify-between gap-4">
              <HeadingBlock
                className="min-w-0"
                description="End this browser session and return to sign in."
                size="sm"
                title="Log Out"
                titleAs="h3"
              />
              <Button
                disabled={isSigningOut}
                onClick={signOut}
                type="button"
                variant="outline"
              >
                <LogOut data-icon="inline-start" />
                {isSigningOut ? "Signing out..." : "Log out"}
              </Button>
            </div>
          </AccountSection>
        </AccountSectionStack>
      )}
    </AccountPageShell>
  );
}

export { AccountPageShell, AccountProfilePage, AccountSecurityPage };
