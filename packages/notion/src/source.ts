import { createNotion, type CreateNotionOptions } from "@fumadocs/notion/source";

export {
  isNotionPageData,
  blocksToPlainText,
  blocksToStructuredData,
  blocksToTableOfContents,
  getBlockText,
  getHeadingDepth,
  richTextToPlainText,
  type NotionBlock,
  type NotionIntegration,
  type NotionPageData,
  type NotionPageInfo,
  type NotionPageLoaded,
  type NotionPropertyMap,
  type NotionQuery,
  type NotionSourceOptions,
} from "@fumadocs/notion/source";

/** @deprecated use `createNotion()` of `@fumadocs/notion` */
export const fumapressNotion = createNotion;

/** @deprecated use `CreateNotionOptions` of `@fumadocs/notion` */
export interface FumapressNotionOptions extends CreateNotionOptions {}
