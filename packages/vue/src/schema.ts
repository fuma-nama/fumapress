/**
 * The schemas of the frontmatter and `meta.json` files of Fumadocs, Zod objects to extend: `pageSchema.extend({ date:
 * z.string() })`. They import `zod`, which a site that uses them installs.
 */
export { metaSchema, pageSchema } from "fumadocs-core/source/schema";
