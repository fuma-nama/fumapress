import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import z from "zod";

/** frontmatter of blog posts, the defaults of the blog plugin read `tags`, `authors` and `image` */
export const blogPageSchema = pageSchema.extend({
  /** publish date, read as the creation date of the post */
  date: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  /** author ids, resolved with the `authors` option of the blog plugin */
  authors: z.array(z.string()).optional(),
  /** cover image URL */
  image: z.string().optional(),
});

export const blogMetaSchema = metaSchema;
