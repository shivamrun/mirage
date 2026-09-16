import { notFound } from "next/navigation";

import { getContentOgImage } from "@/components/content/content-og-image";
import { articleSource } from "@/shared/content/source";

type ArticleOpenGraphImageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ArticleOpenGraphImageProps,
) {
  const { slug } = await params;
  const page = articleSource.getPage([slug]);

  if (!page || page.data.draft) {
    notFound();
  }

  return getContentOgImage({
    description: page.data.social.description ?? page.data.description,
    eyebrow: page.data.category,
    title: page.data.social.title ?? page.data.title,
  });
}
