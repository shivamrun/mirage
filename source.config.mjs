import { pageSchema } from "fumadocs-core/source/schema";
import { defineCollections, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

const dateTimeSchema = z.string().datetime({ offset: true });

const socialProfileSchema = z
  .object({
    website: z.string().optional(),
    x: z.string().optional(),
    twitter: z.string().optional(),
    linkedin: z.string().optional(),
    github: z.string().optional(),
    youtube: z.string().optional(),
    instagram: z.string().optional(),
    facebook: z.string().optional(),
    mastodon: z.string().optional(),
  })
  .catchall(z.string());

const authorSchema = z.object({
  type: z.enum(["Person", "Organization"]).default("Person"),
  name: z.string(),
  url: z.string().optional(),
  image: z.string().optional(),
  jobTitle: z.string().optional(),
  sameAs: z.array(z.string()).default([]),
  social: socialProfileSchema.default({}),
});

const seoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  canonical: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  noIndex: z.boolean().default(false),
  noFollow: z.boolean().default(false),
});

const socialSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  image: z.string().optional(),
  imageAlt: z.string().optional(),
  imageWidth: z.number().int().positive().optional(),
  imageHeight: z.number().int().positive().optional(),
  images: z.array(z.string()).default([]),
  card: z.enum(["summary", "summary_large_image"]).optional(),
});

const publishingSchema = {
  seo: seoSchema.default({}),
  social: socialSchema.default({}),
  author: authorSchema.default({
    name: "Mirage",
    url: "/authors/mirage",
  }),
  publishedAt: dateTimeSchema,
  updatedAt: dateTimeSchema.optional(),
  tags: z.array(z.string()).default([]),
  topics: z.array(z.string()).default([]),
  audience: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  draft: z.boolean().default(false),
  language: z.string().default("en"),
  schemaType: z.string().optional(),
};

export const guides = defineDocs({
  dir: "content/guides",
  docs: {
    schema: pageSchema.extend({
      type: z.literal("guide").default("guide"),
      platform: z.string().optional(),
      verifiedAt: dateTimeSchema.optional(),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      requirements: z.array(z.string()).default([]),
      resources: z.array(z.string()).default([]),
      ...publishingSchema,
    }),
  },
});

export const articles = defineCollections({
  type: "doc",
  dir: "content/articles",
  schema: pageSchema.extend({
    type: z.literal("article").default("article"),
    category: z.string().default("Industry"),
    series: z.string().optional(),
    ...publishingSchema,
  }),
});
