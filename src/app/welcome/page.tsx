import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import AuthContainer from "@/components/auth/auth-container";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { normalizeRoles, requireAuth } from "@/lib/auth/access";

export const metadata: Metadata = {
  title: "Welcome | Mirage",
};

type WelcomeState = "creator" | "moderator" | "account";
type InviteUpgradeRole = Exclude<WelcomeState, "account">;

type WelcomePageProps = {
  searchParams: Promise<{
    newUser?: string;
    upgraded?: string;
  }>;
};

const welcomeContent: Record<
  WelcomeState,
  {
    href: string;
    label: string;
    joinedDescription: string;
    joinedTitle: string;
    upgradedDescription: string;
    upgradedTitle: string;
  }
> = {
  creator: {
    href: "/creator",
    joinedDescription:
      "Your invitation has been accepted. Your creator workspace is ready inside Mirage.",
    joinedTitle: "Creator access is active",
    label: "Open creator workspace",
    upgradedDescription:
      "Creator access has been added to your account. Your workspace is ready when you are.",
    upgradedTitle: "Creator access is active",
  },

  moderator: {
    href: "/moderator",
    joinedDescription:
      "Your invitation has been accepted. Your moderator workspace is ready inside Mirage.",
    joinedTitle: "Moderator access is active",
    label: "Open moderator workspace",
    upgradedDescription:
      "Moderator access has been added to your account. Your workspace is ready when you are.",
    upgradedTitle: "Moderator access is active",
  },

  account: {
    href: "/account",
    joinedDescription:
      "Your Mirage account is ready. You can manage your profile and account settings from here.",
    joinedTitle: "Welcome to Mirage",
    label: "Go to account",
    upgradedDescription:
      "Your Mirage account is ready. You can manage your profile and account settings from here.",
    upgradedTitle: "Welcome to Mirage",
  },
};

function isInviteUpgradeRole(value?: string): value is InviteUpgradeRole {
  return value === "creator" || value === "moderator";
}

function getWelcomeState(roles: string[]): WelcomeState {
  if (roles.includes("moderator")) {
    return "moderator";
  }

  if (roles.includes("creator")) {
    return "creator";
  }

  return "account";
}

export default async function WelcomePage({ searchParams }: WelcomePageProps) {
  const { newUser, upgraded } = await searchParams;
  const user = await requireAuth({
    callbackUrl: "/welcome",
  });
  const roles = normalizeRoles(user.role);
  const welcomeState = isInviteUpgradeRole(upgraded)
    ? upgraded
    : getWelcomeState(roles);
  const content = welcomeContent[welcomeState];
  const wasUpgraded = isInviteUpgradeRole(upgraded) && newUser === "false";
  const title = wasUpgraded ? content.upgradedTitle : content.joinedTitle;
  const description = `${
    wasUpgraded ? content.upgradedDescription : content.joinedDescription
  }`;

  return (
    <AuthContainer
      authForm={
        <AuthFormShell
          title={title}
          description={description}
          footer={
            <Link className="link-text" href="/account">
              Manage account
            </Link>
          }
        >
          <div className="flex flex-col gap-5">
            <Button asChild className="w-full">
              <Link href={content.href}>
                <BadgeCheck aria-hidden="true" />
                {content.label}
              </Link>
            </Button>
          </div>
        </AuthFormShell>
      }
    />
  );
}
