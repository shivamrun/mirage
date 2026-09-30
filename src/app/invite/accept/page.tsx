import { BadgeCheck, KeyRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/features/auth/components";
import { getSafeAuthRedirect } from "@/features/auth/redirect";
import { validateInvitationToken } from "@/server/db/services/invitations/service";
import { getPageMetadata, siteConfig } from "@/shared/metadata";

export const metadata = getPageMetadata("Accept Invitation", {
  path: "/invite/accept",
});

type InviteAcceptPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
    token?: string;
  }>;
};

function InvalidInvitation({ status }: { status: string }) {
  const message =
    status === "expired"
      ? "This invitation has expired."
      : status === "accepted"
        ? "This invitation has already been accepted."
        : status === "revoked"
          ? "This invitation has been revoked."
          : "This invitation is not available.";

  return (
    <section className="w-full max-w-md text-center">
      <div className="mb-6 space-y-2 pt-4 pb-2">
        <h1 className="text-4xl">Invitation unavailable</h1>
        <p className="mt-3 text-muted-foreground text-base">{message}</p>
      </div>

      <Link className="link-text" href="/login">
        Return to sign in
      </Link>
    </section>
  );
}

export default async function InviteAcceptPage({
  searchParams,
}: InviteAcceptPageProps) {
  const { callbackURL, token = "" } = await searchParams;
  const validation = await validateInvitationToken(token);

  return (
    <main className="relative grid min-h-screen lg:grid-cols-2">
      <div className="absolute top-8 left-8 z-10 flex items-center gap-3">
        <Image
          src={siteConfig.logo}
          alt={`${siteConfig.name} logo`}
          width={36}
          height={36}
          className="size-9"
          priority
        />

        <span className="font-medium text-2xl">{siteConfig.name}</span>
      </div>

      <section className="flex min-h-screen items-center justify-center px-6 py-24 lg:px-12">
        {validation.valid && validation.email ? (
          <RegisterForm
            redirectTo={getSafeAuthRedirect(callbackURL || "/account")}
            invitedEmail={validation.email}
            invitationToken={token}
          />
        ) : (
          <InvalidInvitation status={validation.status} />
        )}
      </section>

      <section className="hidden min-h-screen bg-secondary/35 p-6 lg:block">
        <div className="flex h-full min-h-[calc(100vh-3rem)] flex-col justify-between overflow-hidden rounded-lg border border-border bg-card p-12">
          <div className="max-w-xl space-y-6">
            <Image
              src="/logo.svg"
              alt=""
              width={64}
              height={64}
              className="size-16 drop-shadow-sm"
            />

            <p className="font-medium text-muted-foreground text-sm uppercase">
              Invitation
            </p>

            <h1 className="text-5xl leading-[1.05]">
              Finish setting up your account.
            </h1>

            <p className="max-w-md text-muted-foreground leading-relaxed">
              Your invite is tied to one email address and grants access only
              after signup completes.
            </p>
          </div>

          <div className="grid gap-5">
            {[
              {
                description:
                  "The invited email stays locked through account creation.",
                icon: KeyRound,
                label: "Email locked",
              },
              {
                description:
                  "Access is applied only after the invitation is claimed.",
                icon: BadgeCheck,
                label: "Role secured",
              },
            ].map(({ description, icon: Icon, label }) => (
              <div
                key={label}
                className="grid grid-cols-[auto,1fr] items-start gap-4 border-border border-t pt-5"
              >
                <Icon
                  className="mt-0.5 size-5 text-primary"
                  strokeWidth={1.8}
                />

                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="mt-1 text-muted-foreground text-sm leading-5">
                    {description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
