import {
  ArrowRight,
  Database,
  LockKeyhole,
  ShieldCheck,
  User,
} from "lucide-react";
import Link from "next/link";
import { AppHeader } from "@/components/app/app-header";
import { Button } from "@/components/ui/button";
import { EmailSignupForm } from "@/features/email-list/components";
import { getCurrentUser } from "@/server/db/services/auth/access";
import { siteConfig } from "@/shared/metadata";

const starterModules = [
  {
    description:
      "Email sign-up, sign-in, verification, password reset, and Google OAuth hooks.",
    icon: LockKeyhole,
    title: "Auth",
  },
  {
    description: "Account and admin workspaces are protected by role gates.",
    icon: ShieldCheck,
    title: "Access",
  },
  {
    description:
      "Drizzle schema, migrations, Elysia routes, and local Postgres are ready.",
    icon: Database,
    title: "Data",
  },
] as const;

const workspaceLinks = [
  {
    description: "Profile, password, email, and connected account controls.",
    href: "/account",
    icon: User,
    label: "Account",
  },
  {
    description: "User overview and admin-only controls.",
    href: "/admin",
    icon: ShieldCheck,
    label: "Admin",
  },
] as const;

const legalLinks = [
  {
    href: "/privacy",
    label: "Privacy",
  },
  {
    href: "/terms",
    label: "Terms",
  },
  {
    href: "/cookies",
    label: "Cookies",
  },
  {
    href: "/acceptable-use",
    label: "Acceptable use",
  },
] as const;

const Page = async () => {
  const user = await getCurrentUser();

  return (
    <main className="min-h-dvh bg-background">
      <AppHeader isAuthenticated={Boolean(user)} />

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-20">
        <div className="flex flex-col gap-8">
          <div className="space-y-5">
            <p className="font-medium text-primary text-sm uppercase">
              Starter platform
            </p>
            <h1 className="max-w-3xl font-semibold text-4xl leading-tight sm:text-5xl lg:text-6xl">
              A calm starting point for your next product.
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground leading-8">
              {siteConfig.name} ships with the product plumbing already in
              place: authenticated users, role-aware workspaces, API routes, and
              a Postgres-backed data layer.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/register">
                Start building
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login">Open existing account</Link>
            </Button>
          </div>

          <div className="grid max-w-3xl gap-3 md:grid-cols-2">
            <section className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 space-y-1">
                <h2 className="font-semibold text-lg">Join the waitlist</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Get early access and launch updates.
                </p>
              </div>
              <EmailSignupForm
                inputId="home-waitlist-email"
                listKey="waitlist"
                source="home-hero"
                submitLabel="Join waitlist"
              />
            </section>

            <section className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 space-y-1">
                <h2 className="font-semibold text-lg">Get the newsletter</h2>
                <p className="text-muted-foreground text-sm leading-6">
                  Receive product notes and occasional behind-the-scenes
                  updates.
                </p>
              </div>
              <EmailSignupForm
                inputId="home-newsletter-email"
                listKey="newsletter"
                source="home-newsletter"
                submitLabel="Subscribe"
              />
            </section>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {starterModules.map(({ description, icon: Icon, title }) => (
              <section
                className="rounded-lg border border-border bg-card p-5"
                key={title}
              >
                <Icon className="mb-4 size-5 text-primary" />
                <h2 className="font-semibold">{title}</h2>
                <p className="mt-2 text-muted-foreground text-sm leading-6">
                  {description}
                </p>
              </section>
            ))}
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-border bg-card p-5">
          <div className="border-border border-b pb-4">
            <p className="font-medium text-sm">Workspace routes</p>
            <p className="mt-1 text-muted-foreground text-sm">
              The starter shell is already wired for protected screens.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {workspaceLinks.map(({ description, href, icon: Icon, label }) => (
              <Link
                className="group grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 transition-colors hover:bg-muted/60"
                href={href}
                key={href}
              >
                <Icon className="size-4 text-primary" />
                <span className="min-w-0">
                  <span className="block font-medium text-sm">{label}</span>
                  <span className="mt-0.5 block text-muted-foreground text-xs leading-5">
                    {description}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        </aside>
      </section>

      <footer className="border-border border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>{siteConfig.name}</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal">
            {legalLinks.map((link) => (
              <Link className="link-text" href={link.href} key={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </footer>
    </main>
  );
};

export default Page;
