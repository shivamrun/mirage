import type { Metadata, Viewport } from "next";

const fallbackSiteUrl = "http://localhost:3000";
const appName = "Mirage";
const appDescription =
  "A starter Next.js platform for authenticated accounts, role-gated admin workspaces, API routes, and Postgres-backed product data.";

export const siteConfig = {
  name: appName,
  shortName: appName,
  description: appDescription,
  creator: appName,
  logo: "/logo.svg",
  links: {
    home: "/",
  },
  keywords: [
    "Mirage",
    "Next.js starter",
    "Next.js authentication",
    "Better Auth",
    "role-based access control",
    "admin dashboard",
    "Drizzle ORM",
    "Postgres starter",
    "Elysia API",
    "product starter",
  ],
} as const;

export function getSiteUrl() {
  const rawUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.VERCEL_PROJECT_PRODUCTION_URL ??
    fallbackSiteUrl;
  const withProtocol = /^https?:\/\//i.test(rawUrl)
    ? rawUrl
    : `https://${rawUrl}`;

  return new URL(withProtocol);
}

export function absoluteUrl(pathOrUrl: string) {
  return new URL(pathOrUrl, getSiteUrl()).toString();
}

export function getPageMetadata(
  title: string,
  options: {
    description?: string;
    path?: string;
  } = {},
): Metadata {
  const description = options.description ?? siteConfig.description;
  const path = options.path ?? "/";
  const fullTitle = `${title} | ${siteConfig.name}`;

  return {
    title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
    },
    twitter: {
      title: fullTitle,
      description,
    },
  };
}

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  applicationName: siteConfig.name,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.shortName}`,
  },
  description: siteConfig.description,
  keywords: [...siteConfig.keywords],
  authors: [{ name: siteConfig.creator }],
  creator: siteConfig.creator,
  publisher: siteConfig.creator,
  category: "technology",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
  },
  twitter: {
    card: "summary",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: siteConfig.logo,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
};

const siteOrigin = getSiteUrl().toString().replace(/\/$/, "");
const organizationId = `${siteOrigin}/#organization`;

export const webApplicationJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": organizationId,
      name: siteConfig.name,
      description: siteConfig.description,
      url: siteOrigin,
    },
    {
      "@type": "WebApplication",
      "@id": `${siteOrigin}/#app`,
      name: siteConfig.name,
      description: siteConfig.description,
      keywords: siteConfig.keywords.join(", "),
      url: siteOrigin,
      applicationCategory: "ProductivityApplication",
      operatingSystem: "Any",
      creator: {
        "@id": organizationId,
      },
      publisher: {
        "@id": organizationId,
      },
      featureList: [
        "Email and password authentication",
        "Google OAuth-ready sign-in",
        "Role-gated admin workspace",
        "Account management",
        "Postgres-backed API routes",
      ],
    },
  ],
};
