"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AccountConnectedAccounts } from "@/components/account/account-connected-accounts";
import { AccountEmailManager } from "@/components/account/account-email-manager";
import { AccountImpersonationNotice } from "@/components/account/account-impersonation-notice";
import { AccountPasswordForm } from "@/components/account/account-password-form";
import { AccountProfileForm } from "@/components/account/account-profile-form";
import { AccountSection } from "@/components/account/account-section";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";

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
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="max-w-2xl space-y-2">
          <h1 className="font-semibold text-2xl tracking-normal sm:text-3xl">
            {title}
          </h1>
          <p className="text-muted-foreground text-sm leading-6">
            {description}
          </p>
        </header>

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
        <div>
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
        </div>
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
      description="Keep your sign-in methods current and control this browser session."
      title="Security"
    >
      {() => (
        <div>
          <AccountSection
            description="Update your password while keeping this session active."
            title="Password"
          >
            <AccountPasswordForm />
          </AccountSection>

          <AccountSection
            description="Manage Google as an additional sign-in method."
            title="Google sign-in"
          >
            <AccountConnectedAccounts
              googleAuthEnabled={googleAuthEnabled}
              googleAccountStatus={googleAccountStatus}
            />
          </AccountSection>

          <AccountSection
            description="End this browser session and return to sign in."
            title="Log out"
          >
            <Button
              className="w-full"
              disabled={isSigningOut}
              onClick={signOut}
              type="button"
              variant="outline"
            >
              <LogOut data-icon="inline-start" />
              {isSigningOut ? "Signing out..." : "Log out"}
            </Button>
          </AccountSection>
        </div>
      )}
    </AccountPageShell>
  );
}

export { AccountProfilePage, AccountSecurityPage };
