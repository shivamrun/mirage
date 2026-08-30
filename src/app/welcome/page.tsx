import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import AuthContainer from "@/components/auth/auth-container";
import { AuthFormShell } from "@/components/auth/auth-form-shell";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth/access";
import { getPageMetadata, siteConfig } from "@/lib/metadata";

export const metadata = getPageMetadata("Welcome", { path: "/welcome" });

export default async function WelcomePage() {
  await requireAuth({
    callbackUrl: "/welcome",
  });

  return (
    <AuthContainer
      authForm={
        <AuthFormShell
          title={`Welcome to ${siteConfig.name}`}
          description={`Your ${siteConfig.name} account is ready. You can manage your profile and account settings from here.`}
          footer={
            <Link className="link-text" href="/account">
              Manage account
            </Link>
          }
        >
          <div className="flex flex-col gap-5">
            <Button asChild className="w-full">
              <Link href="/account">
                <BadgeCheck aria-hidden="true" />
                Go to account
              </Link>
            </Button>
          </div>
        </AuthFormShell>
      }
    />
  );
}
