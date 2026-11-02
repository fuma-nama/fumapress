import type { AppShape } from "@/app/context";
import {
  createDocsLikeLayoutPage,
  type DocsLikeContextData,
  type DocsLikeInterceptor,
  type DocsLikeLayoutOptions,
  type DocsLikeRenderData,
} from "@/components/docs-page";
import { GlassLayout, type GlassLayoutProps } from "fumadocs-ui/layouts/glass";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/glass/page";

export type { PageActionsProps } from "@/components/docs-page";

export interface GlassLayoutOptions<C extends AppShape = AppShape> extends DocsLikeLayoutOptions<
  C,
  GlassLayoutProps,
  DocsPageProps
> {}

export interface GlassLayoutRenderData extends DocsLikeRenderData<
  GlassLayoutProps,
  DocsPageProps
> {}

export type GlassInterceptor<S extends AppShape, T> = DocsLikeInterceptor<S, T>;

export interface GlassLayoutContextData<S extends AppShape = AppShape> extends DocsLikeContextData<
  S,
  GlassLayoutProps,
  DocsPageProps
> {}

export function createGlassLayoutPage<C extends AppShape = AppShape>(
  options: GlassLayoutOptions<NoInfer<C>> = {},
) {
  return createDocsLikeLayoutPage<C, GlassLayoutProps, DocsPageProps>(options, {
    name: "createGlassLayoutPage",
    data: (ctx) => ctx.data["core:glass-layout"],
    DocsLayout: GlassLayout,
    DocsPage,
    DocsTitle,
    DocsDescription,
    DocsBody,
    MarkdownCopyButton,
    ViewOptionsPopover,
    PageLastUpdate,
  });
}
