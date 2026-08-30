import { BadgeCheck, Database, KeyRound } from "lucide-react";
import Image from "next/image";

import { RegisterForm } from "@/components/auth";
import { isGoogleAuthConfigured } from "@/lib/auth";
import { getSafeAuthRedirect } from "@/lib/auth/redirect";
import { getPageMetadata, siteConfig } from "@/lib/metadata";

export const metadata = getPageMetadata("Create Account", {
  path: "/register",
});

type RegisterPageProps = {
  searchParams: Promise<{
    callbackURL?: string;
  }>;
};

const features = [
  {
    description: "Email, password, and Google sign-in are ready to connect.",
    icon: KeyRound,
    label: "Auth ready",
  },
  {
    icon: BadgeCheck,
    description: "Account and admin spaces are role-gated.",
    label: "Role gates",
  },
  {
    description: "Drizzle and Postgres are set up for the first model.",
    icon: Database,
    label: "Data layer",
  },
];

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const { callbackURL } = await searchParams;

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
        <RegisterForm
          redirectTo={getSafeAuthRedirect(callbackURL)}
          googleAuthEnabled={isGoogleAuthConfigured}
        />
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
              {siteConfig.name} starter app
            </p>

            <h1 className="text-5xl leading-[1.05]">
              Start with the product shell already assembled.
            </h1>

            <p className="max-w-md text-muted-foreground leading-relaxed">
              {siteConfig.name} gives a new product a clean base: accounts,
              protected routes, API handlers, and database wiring.
            </p>
          </div>

          <div className="grid gap-5">
            {features.map(({ description, icon: Icon, label }) => (
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
