import {
  APIErrorCode,
  isFullBlock,
  isFullPage,
  isNotionClientError,
  type BlockObjectResponse,
  type PageObjectResponse,
} from "@notionhq/client";
import type { AppShape, PressPlugin } from "fumapress";
import { getNotionFileUrl, isAssetBlock, type NotionAssetBlock } from "./blocks";
import {
  blocksToPlainText,
  blocksToTableOfContents,
  isNotionPageData,
  type NotionIntegration,
  type NotionPageData,
} from "./source";
import { NotionRenderer, type NotionComponents, type NotionRendererProps } from "./renderer";
import type { ComponentType } from "react";

export interface NotionFileProxyOptions {
  /** Dynamic route used to refresh Notion's expiring signed file URLs. @default "/api/notion/file" */
  path?: string;
}

export interface NotionPluginOptions {
  components?: NotionComponents;
  /** Highlight code blocks on the server. Set to `false` to render plain code. */
  highlightCode?: NotionRendererProps["highlightCode"];
  /** Replace the default semantic block renderer. */
  Renderer?: ComponentType<NotionRendererProps>;
  /**
   * Refresh internal Notion file URLs through a dynamic route.
   * Disable this for static exports or when a custom renderer owns file delivery.
   * @default true
   */
  fileProxy?: boolean | NotionFileProxyOptions;
}

export function notionPlugin<C extends AppShape = AppShape>(
  integration: NotionIntegration,
  options: NotionPluginOptions = {},
): PressPlugin<C> {
  const Renderer = options.Renderer ?? NotionRenderer;
  const fileProxy = options.fileProxy ?? true;
  const fileProxyPath =
    typeof fileProxy === "object" ? normalizeProxyPath(fileProxy.path) : "/api/notion/file";

  function matches(data: C["page"]["data"]): data is C["page"]["data"] & NotionPageData {
    if (!isNotionPageData(data)) return false;
    const { parent } = data.notion;
    return (
      parent.type === "data_source_id" &&
      sameNotionId(parent.data_source_id, integration.dataSourceId)
    );
  }

  return {
    name: "notion",
    init() {
      this.adapters.push({
        async "core:get-text"(page) {
          if (!matches(page.data)) return;
          return blocksToPlainText((await page.data.load()).blocks);
        },
        async "core:get-body"(page) {
          if (!matches(page.data)) return;
          const data = page.data;
          const { blocks } = await data.load();
          return {
            node: (
              <Renderer
                blocks={blocks}
                components={options.components}
                highlightCode={options.highlightCode}
                getFileUrl={(block) => {
                  const direct = getNotionFileUrl(block);
                  if (!fileProxy || !direct || !isInternalAsset(block)) return direct;

                  const query = new URLSearchParams({
                    page: data.id,
                    block: block.id,
                  });
                  return `${fileProxyPath}?${query}`;
                }}
              />
            ),
          };
        },
        async "core:render-toc"(page) {
          if (!matches(page.data)) return;
          return blocksToTableOfContents((await page.data.load()).blocks);
        },
        "core:get-creation-date"(page) {
          if (matches(page.data)) return new Date(page.data.notion.created_time);
        },
        "core:get-modified-date"(page) {
          if (matches(page.data)) return new Date(page.data.notion.last_edited_time);
        },
        async "core:get-structured-data"(page) {
          if (matches(page.data)) return page.data.structuredData();
        },
      });
    },
    createPages({ createApi }) {
      if (!fileProxy) return;
      if (this.mode === "static") {
        throw new Error(
          "[@fumapress/notion] The file proxy is not compatible with static mode. Set fileProxy: false and provide durable file URLs with a custom renderer.",
        );
      }

      createApi({
        path: fileProxyPath,
        render: "dynamic",
        handlers: {
          GET: async (request) => {
            const { searchParams } = new URL(request.url);
            const pageId = searchParams.get("page");
            const blockId = searchParams.get("block");
            if (!pageId || !blockId || !isNotionId(pageId) || !isNotionId(blockId)) {
              return new Response("Invalid Notion file request", { status: 400 });
            }

            try {
              const response = await integration.client.blocks.retrieve({ block_id: blockId });
              if (!isFullBlock(response) || !isAssetBlock(response)) {
                return new Response("Notion file not found", { status: 404 });
              }

              const parentPageId = await getParentPageId(integration, response);
              if (!parentPageId || !sameNotionId(parentPageId, pageId)) {
                return new Response("Notion file not found", { status: 404 });
              }

              const page = await integration.client.pages.retrieve({ page_id: pageId });
              if (!isIntegrationPage(page, integration.dataSourceId)) {
                return new Response("Notion file not found", { status: 404 });
              }

              const url = getNotionFileUrl(response);
              if (!url || !/^https?:\/\//.test(url)) {
                return new Response("Notion file not found", { status: 404 });
              }

              return new Response(null, {
                status: 302,
                headers: {
                  "Cache-Control": "private, no-store",
                  Location: url,
                },
              });
            } catch (error) {
              if (isNotionClientError(error) && error.code === APIErrorCode.ObjectNotFound) {
                return new Response("Notion file not found", { status: 404 });
              }
              throw error;
            }
          },
        },
      });
    },
  };
}

async function getParentPageId(
  integration: NotionIntegration,
  block: BlockObjectResponse,
): Promise<string | undefined> {
  let current = block;
  const visited = new Set<string>();

  for (let depth = 0; depth < 32; depth++) {
    if (current.parent.type === "page_id") return current.parent.page_id;
    if (current.parent.type !== "block_id" || visited.has(current.parent.block_id)) return;

    visited.add(current.parent.block_id);
    const parent = await integration.client.blocks.retrieve({ block_id: current.parent.block_id });
    if (!isFullBlock(parent)) return;
    current = parent;
  }
}

function isIntegrationPage(
  page: PageObjectResponse | { object: "page"; id: string },
  dataSourceId: string,
): page is PageObjectResponse {
  return (
    isFullPage(page) &&
    page.parent.type === "data_source_id" &&
    sameNotionId(page.parent.data_source_id, dataSourceId)
  );
}

function isInternalAsset(block: NotionAssetBlock): boolean {
  switch (block.type) {
    case "audio":
      return block.audio.type === "file";
    case "embed":
      return isSignedFileUrl(block.embed.url);
    case "file":
      return block.file.type === "file";
    case "image":
      return block.image.type === "file";
    case "pdf":
      return block.pdf.type === "file";
    case "video":
      return block.video.type === "file";
    case "callout":
      return block.callout.icon?.type === "file";
    case "paragraph":
      return block.paragraph.icon?.type === "file";
  }
}

function isSignedFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.searchParams.has("X-Amz-Signature") ||
      url.searchParams.has("X-Amz-Algorithm") ||
      url.hostname.endsWith(".notion-static.com")
    );
  } catch {
    return false;
  }
}

function normalizeProxyPath(value = "/api/notion/file"): string {
  const path = value.startsWith("/") ? value : `/${value}`;
  if (/[?#]/.test(path)) {
    throw new Error("[@fumapress/notion] fileProxy.path cannot include a query or hash");
  }
  return path.length > 1 ? path.replace(/\/+$/, "") : path;
}

function isNotionId(value: string): boolean {
  return /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i.test(
    value,
  );
}

function sameNotionId(a: string, b: string): boolean {
  return a.replaceAll("-", "").toLowerCase() === b.replaceAll("-", "").toLowerCase();
}
