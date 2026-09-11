import { pageSchema } from "fumadocs-core/source/schema";
import { defineCollections, defineDocs } from "fumadocs-mdx/config";
import { z } from "zod";

export const guides = defineDocs({
  dir: "content/guides",
  docs: {
    schema: pageSchema.extend({
      date: z.string().date().optional(),
      platform: z.string().optional(),
    }),
  },
});

export const articles = defineCollections({
  type: "doc",
  dir: "content/articles",
  schema: pageSchema.extend({
    author: z.string().default("Mirage"),
    category: z.string().default("Industry"),
    date: z.string().date(),
    tags: z.array(z.string()).default([]),
  }),
});
