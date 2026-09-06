import * as base from "fumadocs-core/source/schema";
import z from "zod";

export const pageSchema = base.pageSchema;
export const metaSchema = base.metaSchema;

export const blogPageSchema = base.pageSchema.extend({
  /** publish date, read as the creation date of the post */
  date: z.coerce.date().optional(),
  tags: z.array(z.string()).optional(),
  /** author ids, resolved with the `authors` option of the blog plugin */
  authors: z.array(z.string()).optional(),
  /** cover image URL */
  image: z.string().optional(),
});

export const blogMetaSchema = base.metaSchema;
