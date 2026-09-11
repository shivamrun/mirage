import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentCard } from "@/components/content/content-card";
import {
  ContentMetaGrid,
  ContentMetaHeader,
  getContentCardMeta,
  getContentShortDate,
} from "@/components/content/content-meta";
import { getMDXComponents } from "@/components/content/mdx-components";
import {
  getContentJsonLd,
  getContentMetadata,
  getJsonLdScriptContent,
} from "@/lib/content-seo";
import { getGuides, guideSource } from "@/lib/content-source";
import { getPageMetadata } from "@/lib/metadata";

type GuidePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

const guidesMetadata: Metadata = getPageMetadata("Guides", {
  description: "Practical guides, references, and playbooks.",
  path: "/guides",
});

export default async function GuidesPage({ params }: GuidePageProps) {
  const { slug } = await params;

  if (!slug) {
    const guides = getGuides();

    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="max-w-2xl space-y-4">
          <p className="font-medium text-primary text-sm uppercase">Guides</p>
          <h1 className="font-semibold text-4xl leading-tight">
            Practical guides and playbooks.
          </h1>
          <p className="text-lg text-muted-foreground leading-8">
            Focused references for learning, setup, workflows, and decisions.
          </p>
        </div>
        {guides.length > 0 ? (
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {guides.map((guide) => (
              <ContentCard
                description={guide.data.description}
                flags={[
                  ...(guide.data.featured ? ["Featured"] : []),
                  ...(guide.data.draft ? ["Draft"] : []),
                ]}
                href={guide.url}
                key={guide.url}
                meta={getContentCardMeta([
                  guide.data.platform,
                  guide.data.difficulty,
                  getContentShortDate(guide.data.updatedAt),
                ])}
                title={guide.data.title}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-border bg-card p-6">
            <p className="font-medium">No guides published yet.</p>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Guides will appear here once they are added to the content folder.
            </p>
          </div>
        )}
      </div>
    );
  }

  const page = guideSource.getPage(slug);

  if (!page || page.data.draft) {
    notFound();
  }

  const MDX = page.data.body;
  const jsonLd = getContentJsonLd(page.data, {
    collectionName: "Guides",
    path: page.url,
    type: "guide",
  });

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <script
        id={`guide-json-ld-${page.slugs.join("-")}`}
        type="application/ld+json"
      >
        {getJsonLdScriptContent(jsonLd)}
      </script>
      <div className="mb-10 space-y-6">
        <p className="font-medium text-primary text-sm uppercase">
          {page.data.platform ?? "Guide"}
        </p>
        <h1 className="font-semibold text-4xl leading-tight">
          {page.data.title}
        </h1>
        {page.data.description ? (
          <p className="text-lg text-muted-foreground leading-8">
            {page.data.description}
          </p>
        ) : null}
        <ContentMetaHeader
          author={page.data.author}
          draft={page.data.draft}
          featured={page.data.featured}
          publishedAt={page.data.publishedAt}
          updatedAt={page.data.updatedAt}
          verifiedAt={page.data.verifiedAt}
        />
        <ContentMetaGrid
          items={[
            { label: "Difficulty", value: page.data.difficulty },
            { label: "Audience", value: page.data.audience },
            { label: "Requirements", value: page.data.requirements },
            { label: "Resources", value: page.data.resources },
          ]}
        />
      </div>
      <div className="content-prose">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return getGuides().map((page) => ({
    slug: page.slugs,
  }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return guidesMetadata;
  }

  const page = guideSource.getPage(slug);

  if (!page || page.data.draft) {
    notFound();
  }

  return getContentMetadata(page.data, {
    collectionName: "Guides",
    path: page.url,
    type: "guide",
  });
}
