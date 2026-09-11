import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

type ContentAuthor = {
  name: string;
  url?: string;
  sameAs?: string[];
  social?: Record<string, string | undefined>;
};

type ContentMetaGridProps = {
  items: Array<{
    label: string;
    value?: string | string[];
  }>;
};

type ContentMetaHeaderProps = {
  author?: ContentAuthor;
  publishedAt?: string;
  updatedAt?: string;
  verifiedAt?: string;
  featured?: boolean;
  draft?: boolean;
};

function formatDate(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatShortDate(value?: string) {
  if (!value) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

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

function getAuthorSocialLinks(author?: ContentAuthor) {
  const socialLinks = Object.entries(author?.social ?? {}).flatMap(
    ([label, href]) =>
      href ? [{ href, label: formatSocialLabel(label) }] : [],
  );
  const sameAsLinks =
    author?.sameAs?.map((href, index) => ({
      href,
      label: `Profile ${index + 1}`,
    })) ?? [];

  return [...socialLinks, ...sameAsLinks].filter((link, index, links) => {
    return links.findIndex(({ href }) => href === link.href) === index;
  });
}

export function getContentCardMeta(parts: Array<string | undefined>) {
  return parts.filter(Boolean).join(" / ");
}

export function getContentShortDate(value?: string) {
  return formatShortDate(value);
}

export function ContentMetaHeader({
  author,
  draft,
  featured,
  publishedAt,
  updatedAt,
  verifiedAt,
}: ContentMetaHeaderProps) {
  const publishedDate = formatDate(publishedAt);
  const updatedDate = formatDate(updatedAt);
  const verifiedDate = formatDate(verifiedAt);
  const authorSocialLinks = getAuthorSocialLinks(author);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground text-sm">
        {author ? (
          author.url ? (
            <Link className="link-text font-medium" href={author.url}>
              {author.name}
            </Link>
          ) : (
            <span className="font-medium text-foreground">{author.name}</span>
          )
        ) : null}
        {publishedDate ? (
          <time dateTime={publishedAt}>{publishedDate}</time>
        ) : null}
        {updatedDate && updatedAt !== publishedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <Clock3 className="size-3.5" />
            Updated <time dateTime={updatedAt}>{updatedDate}</time>
          </span>
        ) : null}
        {verifiedDate ? (
          <span className="inline-flex items-center gap-1.5">
            <CheckCircle2 className="size-3.5" />
            Verified <time dateTime={verifiedAt}>{verifiedDate}</time>
          </span>
        ) : null}
        {featured ? (
          <span className="rounded-md border border-border px-2 py-0.5 font-medium text-foreground text-xs">
            Featured
          </span>
        ) : null}
        {draft ? (
          <span className="rounded-md border border-border px-2 py-0.5 font-medium text-foreground text-xs">
            Draft
          </span>
        ) : null}
      </div>
      {authorSocialLinks.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {authorSocialLinks.map(({ href, label }) => (
            <Link
              className="inline-flex items-center gap-1 link-text"
              href={href}
              key={`${label}-${href}`}
              rel={isExternalUrl(href) ? "noreferrer" : undefined}
              target={isExternalUrl(href) ? "_blank" : undefined}
            >
              {label}
              {isExternalUrl(href) ? <ExternalLink className="size-3" /> : null}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ContentMetaGrid({ items }: ContentMetaGridProps) {
  const visibleItems = items.filter(({ value }) => {
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });

  if (visibleItems.length === 0) {
    return null;
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {visibleItems.map(({ label, value }) => (
        <div className="space-y-1" key={label}>
          <dt className="flex items-center gap-2 font-medium text-muted-foreground text-xs uppercase">
            {label === "Difficulty" ? (
              <GraduationCap className="size-3.5" />
            ) : null}
            {label}
          </dt>
          <dd className="text-sm leading-6">
            {Array.isArray(value) ? value.join(", ") : value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
