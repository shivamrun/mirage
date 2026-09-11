import { articleSource, guideSource } from "@/lib/content-source";

type AuthorSocial = Record<string, string | undefined>;

export type ContentAuthorProfile = {
  type?: "Person" | "Organization";
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
  social?: AuthorSocial;
};

function slugFromAuthorUrl(url?: string) {
  return url?.split("/").filter(Boolean).at(-1);
}

function slugFromAuthorName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getAuthorSlug(author: ContentAuthorProfile) {
  return slugFromAuthorUrl(author.url) ?? slugFromAuthorName(author.name);
}

export function getAuthors() {
  const authors = new Map<string, ContentAuthorProfile>();

  for (const page of [...articleSource.getPages(), ...guideSource.getPages()]) {
    if (page.data.draft) {
      continue;
    }

    const author = page.data.author;
    authors.set(getAuthorSlug(author), author);
  }

  return [...authors.entries()].map(([slug, author]) => ({
    ...author,
    slug,
  }));
}

export function getAuthor(slug: string) {
  return getAuthors().find((author) => author.slug === slug);
}
