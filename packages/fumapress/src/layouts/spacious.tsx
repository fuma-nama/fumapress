import type { AppShape } from "@/app/context";
import {
  createDocsLikeLayoutPage,
  type DocsLikeContextData,
  type DocsLikeInterceptor,
  type DocsLikeLayoutOptions,
  type DocsLikeRenderData,
} from "@/components/docs-page";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/spacious";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/spacious/page";

export type { PageActionsProps } from "@/components/docs-page";

export interface SpaciousLayoutOptions<C extends AppShape = AppShape> extends DocsLikeLayoutOptions<
  C,
  DocsLayoutProps,
  DocsPageProps
> {}

export interface SpaciousLayoutRenderData extends DocsLikeRenderData<
  DocsLayoutProps,
  DocsPageProps
> {}

export type SpaciousInterceptor<S extends AppShape, T> = DocsLikeInterceptor<S, T>;

export interface SpaciousLayoutContextData<
  S extends AppShape = AppShape,
> extends DocsLikeContextData<S, DocsLayoutProps, DocsPageProps> {}

export function createSpaciousLayoutPage<C extends AppShape = AppShape>(
  options: SpaciousLayoutOptions<NoInfer<C>> = {},
) {
  return createDocsLikeLayoutPage<C, DocsLayoutProps, DocsPageProps>(options, {
    name: "createSpaciousLayoutPage",
    data: (ctx) => ctx.data["core:spacious-layout"],
    DocsLayout,
    DocsPage,
    DocsTitle,
    DocsDescription,
    DocsBody,
    MarkdownCopyButton,
    ViewOptionsPopover,
    PageLastUpdate,
  });
}
