import type { AppShape } from "@/app/context";
import {
  createDocsLikeLayoutPage,
  type DocsLikeContextData,
  type DocsLikeInterceptor,
  type DocsLikeLayoutOptions,
  type DocsLikeRenderData,
} from "@/components/docs-page";
import { DocsLayout, type DocsLayoutProps } from "fumadocs-ui/layouts/notebook";
import {
  MarkdownCopyButton,
  ViewOptionsPopover,
  DocsPage,
  DocsTitle,
  DocsDescription,
  DocsBody,
  type DocsPageProps,
  PageLastUpdate,
} from "fumadocs-ui/layouts/notebook/page";

export type { PageActionsProps } from "@/components/docs-page";

export interface NotebookLayoutOptions<C extends AppShape = AppShape> extends DocsLikeLayoutOptions<
  C,
  DocsLayoutProps,
  DocsPageProps
> {}

export interface NotebookLayoutRenderData extends DocsLikeRenderData<
  DocsLayoutProps,
  DocsPageProps
> {}

export type NotebookInterceptor<S extends AppShape, T> = DocsLikeInterceptor<S, T>;

export interface NotebookLayoutContextData<
  S extends AppShape = AppShape,
> extends DocsLikeContextData<S, DocsLayoutProps, DocsPageProps> {}

export function createNotebookLayoutPage<C extends AppShape = AppShape>(
  options: NotebookLayoutOptions<NoInfer<C>> = {},
) {
  return createDocsLikeLayoutPage<C, DocsLayoutProps, DocsPageProps>(options, {
    name: "createNotebookLayoutPage",
    data: (ctx) => ctx.data["core:notebook-layout"],
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
