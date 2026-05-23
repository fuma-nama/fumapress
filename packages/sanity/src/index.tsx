import {
  createSanitySource,
  GenericSanityOptions,
  type BaseDoc,
  type DocToPage,
} from "@fumadocs/sanity";
import type { DynamicSource, MetaData, PageData } from "fumadocs-core/source";
import type { ConfigContext, ServerPlugin } from "fumapress";
import { z } from "zod/mini";
import { type PortableTextBlock, toPlainText, PortableText } from "@portabletext/react";
import type { SanityClient } from "@sanity/client";
import type { ReactNode } from "react";

export type { BaseDoc, DocToPage, DocToPageLoaded } from "@fumadocs/sanity";

type SourceOptions<Doc extends BaseDoc> = Omit<GenericSanityOptions<Doc>, "client" | "docType">;

export interface SanityIntegration<Doc extends BaseDoc> {
  $inferDoc: Doc;
  client: SanityClient;
  docType: string;

  dynamicSource: (options: SourceOptions<Doc>) => DynamicSource<{
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
  /** renderer for portable text, **highly** recommended to specify yours */
  PortableText?: PortableTextRenderer<B>;
}): SanityIntegration<Doc> {
  const { client, docType } = config;

  return {
    $inferDoc: undefined as never,
    client,
    docType,
    renderer: (config.PortableText as unknown as PortableTextRenderer | undefined) ?? PortableText,
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

const updatedAtSchema = z.looseObject({
  _updatedAt: z.string(),
});

const createdAtSchema = z.looseObject({
  _createdAt: z.string(),
});

export function sanityPlugin<
  C extends ConfigContext = ConfigContext,
  Doc extends BaseDoc = BaseDoc,
>(integration: SanityIntegration<Doc>): ServerPlugin<C> {
  const pageSchema = z.looseObject({
    _id: z.string(),
    _type: z.literal(integration.docType),
    slug: z.optional(
      z.object({
        _type: z.string(),
        current: z.optional(z.string()),
      }),
    ),
    load: z.function(),
  });

  function isSanityPage(data: PageData): data is DocToPage<
    BaseDoc & {
      body?: PortableTextBlock | PortableTextBlock[];
    }
  > {
    return pageSchema.safeParse(data).success;
  }

  const Renderer = integration.renderer;
  return {
    init() {
      this.adapters.push({
        async "core:get-text"(page) {
          if (isSanityPage(page.data)) {
            const data = await page.data.load();
            if (!data.body) return "";
            return toPlainText(data.body);
          }
        },
        async "core:render-body"(page) {
          if (isSanityPage(page.data)) {
            const data = await page.data.load();

            return <Renderer value={data.body} />;
          }
        },
        async "core:render-toc"(page) {
          if (isSanityPage(page.data)) {
            const data = await page.data.load();

            return data.renderToc({
              render: (body) => <Renderer value={body as PortableTextBlock} />,
            });
          }
        },
        async "core:get-creation-date"(page) {
          if (isSanityPage(page.data)) {
            const res = await integration.client.fetch<unknown>(
              `*[_type == $docType && _id == $id][0] { _createdAt }`,
              {
                docType: integration.docType,
                id: page.data._id,
              },
            );

            const parsed = createdAtSchema.safeParse(res);
            if (parsed.success) return new Date(parsed.data._createdAt);
          }
        },
        async "core:get-modified-date"(page) {
          if (isSanityPage(page.data)) {
            const res = await integration.client.fetch<unknown>(
              `*[_type == $docType && _id == $id][0] { _updatedAt }`,
              {
                docType: integration.docType,
                id: page.data._id,
              },
            );

            const parsed = updatedAtSchema.safeParse(res);
            if (parsed.success) return new Date(parsed.data._updatedAt);
          }
        },
        async "core:get-structured-data"(page) {
          if (isSanityPage(page.data)) return page.data.structuredData();
        },
      });
    },
  };
}
