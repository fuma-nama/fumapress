import type { AppShape } from "@/app/context";
import {
  createDocsLikeLayoutPage,
  type DocsLikeContextData,
  type DocsLikeInterceptor,
  type DocsLikeLayoutOptions,
  type DocsLikeRenderData,
} from "@/components/docs-page";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/docs";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/docs/page";

export type { PageActionsProps } from "@/components/docs-page";

export interface DocsLayoutOptions<C extends AppShape = AppShape> extends DocsLikeLayoutOptions<
  C,
  DocsLayoutProps,
  DocsPageProps
> {}

export interface DocsLayoutRenderData extends DocsLikeRenderData<DocsLayoutProps, DocsPageProps> {}

export type DocsInterceptor<S extends AppShape, T> = DocsLikeInterceptor<S, T>;

export interface DocsLayoutContextData<S extends AppShape = AppShape> extends DocsLikeContextData<
  S,
  DocsLayoutProps,
  DocsPageProps
> {}

export function createDocsLayoutPage<C extends AppShape = AppShape>(
  options: DocsLayoutOptions<NoInfer<C>> = {},
) {
  return createDocsLikeLayoutPage<C, DocsLayoutProps, DocsPageProps>(options, {
    name: "createDocsLayoutPage",
    data: (ctx) => ctx.data["core:docs-layout"],
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
