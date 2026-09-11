import { articles, guides } from "collections/server";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";

export const guideSource = loader({
  baseUrl: "/guides",
  source: guides.toFumadocsSource(),
});

export const articleSource = loader({
  baseUrl: "/articles",
  source: toFumadocsSource(articles, []),
});

export function getArticles() {
  return articleSource.getPages().sort((a, b) => {
    return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
  });
}

export function getGuides() {
  return guideSource.getPages().sort((a, b) => {
    return a.data.title.localeCompare(b.data.title);
  });
}
