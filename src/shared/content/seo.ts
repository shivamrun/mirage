import type { Metadata } from "next";

import { absoluteUrl, siteConfig } from "@/shared/metadata";

type SocialProfiles = Record<string, string | undefined>;

type ContentAuthor = {
  type?: "Person" | "Organization";
  name: string;
  url?: string;
  image?: string;
  jobTitle?: string;
  sameAs?: string[];
  social?: SocialProfiles;
};

type ContentSeo = {
  title?: string;
  description?: string;
  canonical?: string;
  keywords?: string[];
  noIndex?: boolean;
  noFollow?: boolean;
};

type ContentSocial = {
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  images?: string[];
  card?: "summary" | "summary_large_image";
};

type ContentSeoData = {
  type?: string;
  title: string;
  description?: string;
  seo?: ContentSeo;
  social?: ContentSocial;
  author?: ContentAuthor;
  category?: string;
  platform?: string;
  publishedAt?: string;
  updatedAt?: string;
  verifiedAt?: string;
  tags?: string[];
  topics?: string[];
  audience?: string[];
  requirements?: string[];
  resources?: string[];
  difficulty?: string;
  featured?: boolean;
  draft?: boolean;
  language?: string;
  schemaType?: string;
  series?: string;
};

type ContentSeoOptions = {
  path: string;
  type: "article" | "guide";
  collectionName: string;
};

function uniqueValues(values: Array<string | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function getFullTitle(title: string) {
  return `${title} | ${siteConfig.name}`;
}

function getSocialImages(data: ContentSeoData) {
  return uniqueValues([data.social?.image, ...(data.social?.images ?? [])]);
}

function isExternalUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function getAuthorSocialUrls(author?: ContentAuthor) {
  return uniqueValues([
    ...(author?.sameAs ?? []),
    ...Object.values(author?.social ?? {}),
  ])
    .filter(isExternalUrl)
    .map((url) => absoluteUrl(url));
}

function getKeywords(data: ContentSeoData) {
  return uniqueValues([
    ...(data.seo?.keywords ?? []),
    ...(data.tags ?? []),
    ...(data.topics ?? []),
    ...(data.audience ?? []),
    ...(data.requirements ?? []),
    ...(data.resources ?? []),
    data.category,
    data.platform,
    data.difficulty,
    data.series,
  ]);
}

function getSchemaType(data: ContentSeoData) {
  if (data.schemaType) {
    return data.schemaType;
  }

  return "Article";
}

export function getContentMetadata(
  data: ContentSeoData,
  { path, type }: ContentSeoOptions,
): Metadata {
  const title = data.seo?.title ?? data.title;
  const description = data.seo?.description ?? data.description;
  const canonical = data.seo?.canonical ?? path;
  const images = getSocialImages(data);
  const socialTitle = data.social?.title ?? title;
  const socialDescription = data.social?.description ?? description;
  const fullTitle = getFullTitle(socialTitle);
  const authorUrl = data.author?.url ? absoluteUrl(data.author.url) : undefined;
  const shouldNoIndex = data.draft || data.seo?.noIndex;
  const shouldNoFollow = data.draft || data.seo?.noFollow;

  return {
    title,
    description,
    keywords: getKeywords(data),
    authors: data.author
      ? [
          {
            name: data.author.name,
            url: authorUrl,
          },
        ]
      : undefined,
    category: data.category ?? data.platform,
    alternates: {
      canonical,
      languages: data.language
        ? {
            [data.language]: canonical,
          }
        : undefined,
    },
    robots:
      shouldNoIndex || shouldNoFollow
        ? {
            index: !shouldNoIndex,
            follow: !shouldNoFollow,
          }
        : undefined,
    openGraph: {
      type: type === "article" ? "article" : "website",
      url: canonical,
      siteName: siteConfig.name,
      title: fullTitle,
      description: socialDescription,
      images: images.map((url) => ({
        url,
        alt: data.social?.imageAlt,
        width: data.social?.imageWidth,
        height: data.social?.imageHeight,
      })),
      locale: data.language === "en" ? "en_US" : undefined,
      ...(type === "article"
        ? {
            publishedTime: data.publishedAt,
            modifiedTime: data.updatedAt ?? data.publishedAt,
            authors: data.author ? [data.author.name] : undefined,
            section: data.category,
            tags: uniqueValues([...(data.tags ?? []), ...(data.topics ?? [])]),
          }
        : {}),
    },
    twitter: {
      card:
        data.social?.card ??
        (images.length > 0 ? "summary_large_image" : "summary"),
      title: fullTitle,
      description: socialDescription,
      images,
    },
  };
}

export function getContentJsonLd(
  data: ContentSeoData,
  { path, type, collectionName }: ContentSeoOptions,
) {
  const title = data.seo?.title ?? data.title;
  const description = data.seo?.description ?? data.description;
  const url = absoluteUrl(data.seo?.canonical ?? path);
  const images = getSocialImages(data).map((image) => absoluteUrl(image));
  const authorUrl = data.author?.url ? absoluteUrl(data.author.url) : undefined;
  const authorSameAs = getAuthorSocialUrls(data.author);
  const keywords = getKeywords(data);
  const about = uniqueValues([
    ...(data.topics ?? []),
    ...(data.resources ?? []),
  ]);

  return {
    "@context": "https://schema.org",
    "@type": getSchemaType(data),
    headline: title,
    name: title,
    description,
    url,
    mainEntityOfPage: url,
    image: images.length > 0 ? images : undefined,
    thumbnailUrl: images[0],
    inLanguage: data.language,
    datePublished: data.publishedAt,
    dateModified: data.updatedAt ?? data.publishedAt,
    dateCreated: data.publishedAt,
    lastReviewed: data.verifiedAt,
    articleSection: data.category ?? data.platform ?? collectionName,
    keywords: keywords.length > 0 ? keywords.join(", ") : undefined,
    audience:
      data.audience && data.audience.length > 0
        ? data.audience.map((audienceType) => ({
            "@type": "Audience",
            audienceType,
          }))
        : undefined,
    about:
      about.length > 0
        ? about.map((name) => ({
            "@type": "Thing",
            name,
          }))
        : undefined,
    isPartOf: data.series
      ? {
          "@type": "CreativeWorkSeries",
          name: data.series,
        }
      : undefined,
    author: {
      "@type": data.author?.type ?? "Person",
      name: data.author?.name ?? siteConfig.creator,
      url: authorUrl,
      image: data.author?.image ? absoluteUrl(data.author.image) : undefined,
      jobTitle: data.author?.jobTitle,
      sameAs: authorSameAs.length > 0 ? authorSameAs : undefined,
    },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      logo: {
        "@type": "ImageObject",
        url: absoluteUrl(siteConfig.logo),
      },
    },
    ...(type === "guide"
      ? {
          educationalLevel: data.difficulty,
          learningResourceType: "Guide",
          material: data.resources,
          requirements: data.requirements,
        }
      : {}),
  };
}

export function getJsonLdScriptContent(jsonLd: unknown) {
  return JSON.stringify(jsonLd).replace(/</g, "\\u003c");
}
