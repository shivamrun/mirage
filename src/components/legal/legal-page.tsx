import { ArrowLeft, ArrowRight, CheckCircle2, FileText } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/shared/metadata";

type LegalSection = {
  title: string;
  body: readonly string[];
};

type LegalPageProps = {
  title: string;
  description: string;
  href: string;
  lastUpdated: string;
  sections: readonly LegalSection[];
};

const legalDocuments = [
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

export function LegalPage({
  title,
  description,
  href,
  lastUpdated,
  sections,
}: LegalPageProps) {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="border-border border-b">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <Link
            className="flex items-center gap-3"
            href={siteConfig.links.home}
          >
            <Image
              src={siteConfig.logo}
              alt={`${siteConfig.name} logo`}
              width={36}
              height={36}
              className="size-9"
              priority
            />
            <span className="font-semibold text-lg">{siteConfig.name}</span>
          </Link>
          <nav className="flex items-center gap-2" aria-label="Legal actions">
            <Button asChild className="hidden md:inline-flex" variant="ghost">
              <Link href="/guides">Guides</Link>
            </Button>
            <Button asChild className="hidden md:inline-flex" variant="ghost">
              <Link href="/articles">Articles</Link>
            </Button>
            <Button asChild className="hidden sm:inline-flex" variant="ghost">
              <Link href="/contact">Contact</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/">
                <ArrowLeft data-icon="inline-start" />
                Home
              </Link>
            </Button>
          </nav>
        </div>
      </header>

      <div className="border-border border-b bg-muted/30">
        <section className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-16">
          <div className="max-w-3xl space-y-5">
            <Link
              className="link-text inline-flex items-center gap-2 text-sm"
              href="/"
            >
              <ArrowLeft className="size-4" />
              Back to home
            </Link>
            <div className="space-y-4">
              <p className="font-medium text-primary text-sm uppercase">
                Legal center
              </p>
              <h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
                {title}
              </h1>
              <p className="text-lg text-muted-foreground leading-8">
                {description}
              </p>
            </div>
          </div>

          <aside className="h-fit rounded-lg border border-border bg-background p-5">
            <div className="flex items-start gap-3 border-border border-b pb-4">
              <FileText className="mt-0.5 size-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Document status</p>
                <p className="mt-1 text-muted-foreground text-sm">
                  Last updated {lastUpdated}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" />
                Publicly available
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="size-4 text-primary" />
                Account-aware language
              </div>
            </div>
          </aside>
        </section>
      </div>

      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:py-14">
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          <nav
            className="grid gap-2 rounded-lg border border-border bg-card p-2"
            aria-label="Legal documents"
          >
            {legalDocuments.map((document) => {
              const isActive = document.href === href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={[
                    "flex items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                  href={document.href}
                  key={document.href}
                >
                  <span>{document.label}</span>
                  <ArrowRight className="size-4" />
                </Link>
              );
            })}
          </nav>
        </aside>

        <article className="min-w-0">
          <div className="space-y-5">
            {sections.map((section, index) => (
              <section
                className="rounded-lg border border-border bg-card p-5 sm:p-6"
                key={section.title}
              >
                <div className="flex items-start gap-4">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted font-medium text-muted-foreground text-sm">
                    {index + 1}
                  </span>
                  <div className="min-w-0 space-y-3">
                    <h2 className="font-semibold text-xl">{section.title}</h2>
                    {section.body.map((paragraph) => (
                      <p
                        className="text-muted-foreground leading-7"
                        key={paragraph}
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            ))}
          </div>

          <footer className="mt-8 rounded-lg border border-border bg-muted/30 p-5 text-muted-foreground text-sm leading-6">
            Questions about this page can be sent through the{" "}
            <Link className="link-text" href="/contact">
              contact page
            </Link>
            .
          </footer>
        </article>
      </div>
    </main>
  );
}
