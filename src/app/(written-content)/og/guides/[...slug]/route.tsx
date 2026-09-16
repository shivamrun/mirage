import { notFound } from "next/navigation";

import { getContentOgImage } from "@/components/content/content-og-image";
import { guideSource } from "@/shared/content/source";

type GuideOpenGraphImageProps = {
  params: Promise<{
    slug: string[];
  }>;
};

export async function GET(
  _request: Request,
  { params }: GuideOpenGraphImageProps,
) {
  const { slug } = await params;
  const page = guideSource.getPage(slug);

  if (!page || page.data.draft) {
    notFound();
  }

  return getContentOgImage({
    description: page.data.social.description ?? page.data.description,
    eyebrow: page.data.platform,
    title: page.data.social.title ?? page.data.title,
  });
}
