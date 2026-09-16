import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ContentMetaHeader } from "@/components/content/content-meta";
import { getMDXComponents } from "@/components/content/mdx-components";
import {
  getContentJsonLd,
  getContentMetadata,
  getJsonLdScriptContent,
} from "@/shared/content/seo";
import { articleSource, getArticles } from "@/shared/content/source";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const page = articleSource.getPage([slug]);

  if (!page || page.data.draft) {
    notFound();
  }

  const MDX = page.data.body;
  const jsonLd = getContentJsonLd(page.data, {
    collectionName: "Articles",
    path: page.url,
    type: "article",
  });

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <script id={`article-json-ld-${slug}`} type="application/ld+json">
        {getJsonLdScriptContent(jsonLd)}
      </script>
      <div className="mb-10 space-y-6">
        <p className="font-medium text-primary text-sm uppercase">
          {page.data.category}
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
        />
      </div>
      <div className="content-prose">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return getArticles().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = articleSource.getPage([slug]);

  if (!page || page.data.draft) {
    notFound();
  }

  return getContentMetadata(page.data, {
    collectionName: "Articles",
    path: page.url,
    type: "article",
  });
}
