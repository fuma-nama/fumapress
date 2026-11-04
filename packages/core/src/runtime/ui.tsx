import { createElement, Fragment, type ReactNode } from "react";
import { i18nProvider } from "fumadocs-ui/i18n";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/docs/page";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import type { Context } from "../context";
import type { DocsPageData, LangEnv } from "../plugin";
import type { BaseOptions, DefaultPageProps, PageNode, ProviderProps } from "../press";

/*
 * The built-in UI of both runtimes. Waku renders it on the server, Astro re-exports it from a `'use client'` module so the
 * island hydrates it. Its classes are in the preset CSS of each runtime, so a site stylesheet can override them.
 */

export interface DefaultDocsProps extends Pick<DefaultPageProps, "tree" | "baseOptions"> {
  pageData: DocsPageData;
  /** the items of `page.actions` */
  actions: ReactNode;
  /** the items of `page.footer` */
  footer: ReactNode;
  /** the body */
  children: ReactNode;
}

/** the Docs Layout and page of a content page */
export function DefaultDocs({
  tree,
  baseOptions,
  pageData,
  actions,
  footer,
  children,
}: DefaultDocsProps) {
  return (
    <DocsLayout {...baseOptions} tree={tree}>
      <DocsPage toc={pageData.toc} full={pageData.full}>
        <DocsTitle>{pageData.title}</DocsTitle>
        <DocsDescription className="mb-0">{pageData.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          {pageData.markdownUrl && <MarkdownCopyButton markdownUrl={pageData.markdownUrl} />}
          <ViewOptionsPopover markdownUrl={pageData.markdownUrl} githubUrl={pageData.githubUrl} />
          {actions}
        </div>
        <DocsBody>{children}</DocsBody>
        {pageData.lastModified && <PageLastUpdate date={pageData.lastModified} />}
        {footer}
      </DocsPage>
    </DocsLayout>
  );
}

/** the Home Layout around content: plugin views and the 404 page */
export function HomeShell({
  baseOptions,
  children,
}: {
  baseOptions: BaseOptions;
  children: ReactNode;
}) {
  return (
    <HomeLayout {...baseOptions}>
      <main
        data-fd-home-layout-container=""
        className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto"
      >
        {children}
      </main>
    </HomeLayout>
  );
}

/** the built-in UI: `DefaultDocs` for content pages, `HomeShell` around the content of plugins */
export function renderDefault(props: DefaultPageProps): PageNode {
  if (props.page && !props.children)
    return createElement(DefaultDocs, {
      tree: props.tree,
      baseOptions: props.baseOptions,
      pageData: props.pageData,
      actions: createElement(Fragment, null, ...Object.values(props.actions)),
      footer: createElement(Fragment, null, ...Object.values(props.footer)),
      children: props.body,
    });
  return createElement(HomeShell, { baseOptions: props.baseOptions, children: props.children });
}

/** the root provider's `i18n` from the site's translations in `lang` */
export function siteI18n(ctx: Context, { lang }: LangEnv<any>): ProviderProps["i18n"] {
  const translations = ctx.translationsConfig;
  if (!translations) return;
  return "config" in translations ? i18nProvider(translations, lang) : i18nProvider(translations);
}

/** `own` (`ui.providerProps.i18n`) over the site's translations */
export function mergeI18n(
  site: ProviderProps["i18n"],
  own: ProviderProps["i18n"],
): ProviderProps["i18n"] {
  if (!own || !site) return own ?? site;
  return { ...site, ...own, translations: { ...site.translations, ...own.translations } };
}
