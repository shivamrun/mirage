import type { Metadata } from "next";

import { ContentCard } from "@/components/content/content-card";
import { getArticles } from "@/lib/content-source";

export const metadata: Metadata = {
  title: "Articles",
  description: "Evergreen industry articles and SEO-focused explainers.",
  alternates: {
    canonical: "/articles",
  },
};

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
              href={article.url}
              key={article.url}
              meta={`${article.data.category} / ${new Date(
                article.data.date,
              ).toLocaleDateString("en", {
                month: "short",
                year: "numeric",
              })}`}
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
