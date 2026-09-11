import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getAuthor, getAuthors } from "@/lib/authors";
import { getPageMetadata } from "@/lib/metadata";

type AuthorPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function formatSocialLabel(label: string) {
  if (label === "x") {
    return "X";
  }

  return label
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

export default async function AuthorPage({ params }: AuthorPageProps) {
  const { slug } = await params;
  const author = getAuthor(slug);

  if (!author) {
    notFound();
  }

  const socialLinks = Object.entries(author.social ?? {}).flatMap(
    ([label, href]) =>
      href ? [{ href, label: formatSocialLabel(label) }] : [],
  );

  return (
    <section className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="space-y-5">
        <p className="font-medium text-primary text-sm uppercase">
          {author.type ?? "Author"}
        </p>
        <h1 className="font-semibold text-4xl leading-tight">{author.name}</h1>
        {author.jobTitle ? (
          <p className="text-lg text-muted-foreground leading-8">
            {author.jobTitle}
          </p>
        ) : null}
        {socialLinks.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            {socialLinks.map(({ href, label }) => (
              <Link
                className="inline-flex items-center gap-1 link-text"
                href={href}
                key={`${label}-${href}`}
                rel={isExternalUrl(href) ? "noreferrer" : undefined}
                target={isExternalUrl(href) ? "_blank" : undefined}
              >
                {label}
                {isExternalUrl(href) ? (
                  <ExternalLink className="size-3" />
                ) : null}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function generateStaticParams() {
  return getAuthors().map((author) => ({
    slug: author.slug,
  }));
}

export async function generateMetadata({
  params,
}: AuthorPageProps): Promise<Metadata> {
  const { slug } = await params;
  const author = getAuthor(slug);

  if (!author) {
    notFound();
  }

  return getPageMetadata(author.name, {
    description: `Published work and profile links for ${author.name}.`,
    path: `/authors/${slug}`,
  });
}
