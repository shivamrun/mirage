import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getMDXComponents } from "@/components/content/mdx-components";
import { articleSource } from "@/lib/content-source";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const page = articleSource.getPage([slug]);

  if (!page) {
    notFound();
  }

  const MDX = page.data.body;

  return (
    <article className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="mb-10 space-y-4 border-border border-b pb-8">
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
        <p className="text-muted-foreground text-sm">
          {page.data.author} /{" "}
          {new Date(page.data.date).toLocaleDateString("en", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>
      <div className="content-prose">
        <MDX components={getMDXComponents()} />
      </div>
    </article>
  );
}

export function generateStaticParams() {
  return articleSource.getPages().map((page) => ({
    slug: page.slugs[0],
  }));
}

export async function generateMetadata({
  params,
}: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = articleSource.getPage([slug]);

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
