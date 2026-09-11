import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentCard } from "@/components/content/content-card";
import { getMDXComponents } from "@/components/content/mdx-components";
import { getGuides, guideSource } from "@/lib/content-source";

type GuidePageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

const guidesMetadata: Metadata = {
  title: "Guides",
  description: "Platform-specific guides for Mirage.",
  alternates: {
    canonical: "/guides",
  },
};

export default async function GuidesPage({ params }: GuidePageProps) {
  const { slug } = await params;

  if (!slug) {
    const guides = getGuides();

    return (
      <div className="mx-auto w-full max-w-5xl px-6 py-12">
        <div className="max-w-2xl space-y-4">
          <p className="font-medium text-primary text-sm uppercase">Guides</p>
          <h1 className="font-semibold text-4xl leading-tight">
            Platform-specific playbooks.
          </h1>
          <p className="text-lg text-muted-foreground leading-8">
            Practical implementation notes for using and extending the platform.
          </p>
        </div>
        {guides.length > 0 ? (
          <div className="mt-10 grid gap-3 md:grid-cols-2">
            {guides.map((guide) => (
              <ContentCard
                description={guide.data.description}
                href={guide.url}
                key={guide.url}
                meta={guide.data.platform}
                title={guide.data.title}
              />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-lg border border-border bg-card p-6">
            <p className="font-medium">No guides published yet.</p>
            <p className="mt-2 text-muted-foreground text-sm leading-6">
              Platform-specific guides will appear here once they are added to
              the content folder.
            </p>
          </div>
        )}
      </div>
    );
  }

  const page = guideSource.getPage(slug);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-10 space-y-4 border-border border-b pb-8">
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
      </div>
      <div className="content-prose">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return guideSource.generateParams();
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return guidesMetadata;
  }

  const page = guideSource.getPage(slug);

  if (!page) {
    notFound();
  }

  return {
    title: page.data.title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
    },
  };
}
