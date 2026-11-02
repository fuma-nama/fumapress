import {
  createSanitySource,
  type GenericSanityOptions,
  type BaseDoc,
  type DocToPage,
} from "@fumadocs/sanity";
import * as Fumadocs from "@fumadocs/sanity/plugin";
import type { Plugin } from "fumadocs-core/framework/plugin";
import type { DynamicSource, MetaData, PageData } from "fumadocs-core/source";
import { z } from "zod/mini";
import { type PortableTextBlock, PortableText as DefaultPortableText } from "@portabletext/react";
import type { SanityClient } from "@sanity/client";
import type { ReactNode } from "react";

export type { BaseDoc, DocToPage, DocToPageLoaded } from "@fumadocs/sanity";

type SourceOptions<Doc extends BaseDoc> = Omit<GenericSanityOptions<Doc>, "client" | "docType">;

export interface SanityIntegration<Doc extends BaseDoc> {
  $inferDoc: Doc;
  client: SanityClient;
  docType: string;

  dynamicSource: (options?: SourceOptions<Doc>) => DynamicSource<{
    pageData: DocToPage<Doc>;
    metaData: MetaData;
  }>;

  renderer: PortableTextRenderer;
}

export function fumapressSanity<
  Doc extends BaseDoc,
  B extends TypedObject = PortableTextBlock,
>(config: {
  client: SanityClient;
  /** document name for docs pages */
  docType: string;
  /** renderer for portable text */
  PortableText?: PortableTextRenderer<B>;
}): SanityIntegration<Doc> {
  const { client, docType } = config;

  return {
    $inferDoc: undefined as never,
    client,
    docType,
    renderer: (config.PortableText ?? DefaultPortableText) as unknown as PortableTextRenderer,
    dynamicSource(options) {
      return createSanitySource<Doc>({ client, docType, ...options });
    },
  };
}

interface TypedObject {
  /**
   * Identifies the type of object/span this is, and is used to pick the correct React components
   * to use when rendering a span or inline object with this type.
   */
  _type: string;
  /**
   * Uniquely identifies this object within its parent block.
   * Not _required_, but highly encouraged.
   */
  _key?: string;
}

export type PortableTextRenderer<B extends TypedObject = PortableTextBlock> = (props: {
  /**
   * One or more blocks to render
   */
  value: B | B[] | null | undefined;
}) => ReactNode;

/**
 * @deprecated use `sanityPlugin()` of `@fumadocs/sanity/plugin`, with the `components` of Portable Text in place of a `PortableText` renderer
 */
export function sanityPlugin<Doc extends BaseDoc = BaseDoc>(
  integration: SanityIntegration<Doc>,
): Plugin {
  const plugin = Fumadocs.sanityPlugin();
  const Renderer = integration.renderer;
  if (Renderer === DefaultPortableText) return plugin;

  const pageSchema = z.looseObject({
    _id: z.string(),
    _type: z.literal(integration.docType),
    load: z.function(),
  });

  function isSanityPage(data: PageData): data is DocToPage<
    BaseDoc & {
      body?: PortableTextBlock | PortableTextBlock[];
    }
  > {
    return pageSchema.safeParse(data).success;
  }

  return {
    ...plugin,
    async getPageBody({ data }) {
      if (isSanityPage(data)) return { node: <Renderer value={(await data.load()).body} /> };
    },
  };
}
