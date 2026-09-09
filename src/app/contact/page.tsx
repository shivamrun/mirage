import { ArrowLeft, Clock, Database, Mail } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { ContactForm } from "@/components/contact";
import { Button } from "@/components/ui/button";
import { getPageMetadata, siteConfig } from "@/lib/metadata";

export const metadata = getPageMetadata("Contact", {
  description: `Send a message to ${siteConfig.name}.`,
  path: "/contact",
});

const contactNotes = [
  {
    icon: Clock,
    label: "Useful context",
    text: "Share what you are trying to make, improve, or understand.",
  },
  {
    icon: Database,
    label: "Easy to review",
    text: "Your message is kept with the details you provide.",
  },
  {
    icon: Mail,
    label: "Reply details",
    text: "Use the email address where you would like the conversation to continue.",
  },
] as const;

export default function ContactPage() {
  return (
    <main className="min-h-dvh bg-background">
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
          <Button asChild variant="ghost">
            <Link href="/">
              <ArrowLeft data-icon="inline-start" />
              Home
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-20">
        <div className="max-w-2xl space-y-7">
          <div className="space-y-4">
            <p className="font-medium text-primary text-sm uppercase">
              Contact
            </p>
            <h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
              Send a message.
            </h1>
            <p className="text-lg text-muted-foreground leading-8">
              Tell me what is on your mind and include the details that would
              make a first reply useful.
            </p>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <ContactForm />
          </div>
        </div>

        <aside className="h-fit rounded-lg border border-border bg-card p-5">
          <div className="border-border border-b pb-4">
            <p className="font-medium text-sm">Before sending</p>
            <p className="mt-1 text-muted-foreground text-sm">
              A little specificity keeps the next step crisp.
            </p>
          </div>

          <div className="mt-4 grid gap-4">
            {contactNotes.map(({ icon: Icon, label, text }) => (
              <section className="grid grid-cols-[auto,1fr] gap-3" key={label}>
                <Icon className="mt-0.5 size-4 text-primary" />
                <div>
                  <h2 className="font-medium text-sm">{label}</h2>
                  <p className="mt-1 text-muted-foreground text-sm leading-6">
                    {text}
                  </p>
                </div>
              </section>
            ))}
          </div>
        </aside>
      </section>

      <footer className="border-border border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap gap-x-5 gap-y-2 px-6 py-6 text-sm">
          <Link className="link-text" href="/privacy">
            Privacy
          </Link>
          <Link className="link-text" href="/terms">
            Terms
          </Link>
          <Link className="link-text" href="/cookies">
            Cookies
          </Link>
          <Link className="link-text" href="/acceptable-use">
            Acceptable use
          </Link>
        </div>
      </footer>
    </main>
  );
}
