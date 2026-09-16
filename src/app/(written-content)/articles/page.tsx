import type { Metadata } from "next";

import { ContentCard } from "@/components/content/content-card";
import {
  getContentCardMeta,
  getContentShortDate,
} from "@/components/content/content-meta";
import { getArticles } from "@/shared/content/source";
import { getPageMetadata } from "@/shared/metadata";

export const metadata: Metadata = getPageMetadata("Articles", {
  description: "Evergreen industry articles and SEO-focused explainers.",
  path: "/articles",
});

export default function ArticlesPage() {
  const articles = getArticles();

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <div className="max-w-2xl space-y-4">
        <p className="font-medium text-primary text-sm uppercase">Articles</p>
        <h1 className="font-semibold text-4xl leading-tight">
          Evergreen industry writing.
        </h1>
        <p className="text-lg text-muted-foreground leading-8">
          Durable explainers, strategy notes, and industry context built for
          long-term search value.
        </p>
      </div>
      {articles.length > 0 ? (
        <div className="mt-10 grid gap-3 md:grid-cols-2">
          {articles.map((article) => (
            <ContentCard
              description={article.data.description}
              flags={[
                ...(article.data.featured ? ["Featured"] : []),
                ...(article.data.draft ? ["Draft"] : []),
              ]}
              href={article.url}
              key={article.url}
              meta={getContentCardMeta([
                article.data.category,
                article.data.author.name,
                getContentShortDate(article.data.publishedAt),
              ])}
              title={article.data.title}
            />
          ))}
        </div>
      ) : (
        <div className="mt-10 rounded-lg border border-border bg-card p-6">
          <p className="font-medium">No articles published yet.</p>
          <p className="mt-2 text-muted-foreground text-sm leading-6">
            Evergreen industry articles will appear here once they are added to
            the content folder.
          </p>
        </div>
      )}
    </div>
  );
}
