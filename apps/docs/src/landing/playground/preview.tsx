"use client";
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type MouseEvent,
  type ReactNode,
} from "react";
import { FrameworkProvider } from "fumadocs-core/framework";
import { DocsLayout as DocsLayoutDocs } from "fumadocs-ui/layouts/docs";
import * as DocsPageDocs from "fumadocs-ui/layouts/docs/page";
import { DocsLayout as DocsLayoutNotebook } from "fumadocs-ui/layouts/notebook";
import * as DocsPageNotebook from "fumadocs-ui/layouts/notebook/page";
import type { AIChatOptions, BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared";
import {
  defaultConfig,
  isPlaygroundMessage,
  messageType,
  previewPath,
  siteName,
  type PlaygroundConfig,
  type PlaygroundMessage,
} from "./options";
import { AIChatPanel, Feedback } from "./features";
import {
  GuideBody,
  OperationBody,
  guide,
  href,
  operations,
  sampleTree,
  type Operation,
} from "./sample";
import { themeCss } from "./themes";

/** the page components of each layout */
const pages = { docs: DocsPageDocs, notebook: DocsPageNotebook };

/* a router of its own: the pages of the sample are one state, links never leave the preview */

interface Route {
  path: string;
  navigate: (url: string) => void;
}

const RouteContext = createContext<Route>({ path: previewPath, navigate() {} });
const noParams = {};

function usePathname() {
  return use(RouteContext).path;
}

function useParams() {
  return noParams;
}

function useRouter() {
  const { navigate } = use(RouteContext);
  return useMemo(() => ({ push: navigate, refresh() {} }), [navigate]);
}

/** `Link` of the framework: pages of the sample open in place, `prefetch` has nothing to load */
function RouteLink({ href, onClick, ...rest }: ComponentProps<"a"> & { prefetch?: boolean }) {
  const { prefetch, ...props } = rest;
  void prefetch;
  const { navigate } = use(RouteContext);
  return (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || !href || href.startsWith("#")) return;
        event.preventDefault();
        navigate(href);
      }}
    />
  );
}

/** the page at a path, `undefined` for pages the sample doesn't have */
function resolve(path: string, config: PlaygroundConfig): { operation?: Operation } | undefined {
  if (path === previewPath) return {};
  const operation = config.openapi
    ? operations.find((item) => href(item.slug) === path)
    : undefined;
  return operation && { operation };
}

/** other links of the page stay in place, external ones open */
function blockNavigation(event: MouseEvent) {
  if (event.defaultPrevented) return;
  const anchor = (event.target as Element).closest?.("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) return;
  if (new URL(anchor.href, location.href).origin !== location.origin) return;
  if (anchor.hash && anchor.pathname === location.pathname) return;
  event.preventDefault();
}

/* the docs UI */

function DocsPreview({ config, path }: { config: PlaygroundConfig; path: string }) {
  const { DocsBody, DocsDescription, DocsPage, DocsTitle, MarkdownCopyButton, ViewOptionsPopover } =
    pages[config.layout];
  const [chatOpen, setChatOpen] = useState(false);
  // the chat opens once it is switched on, to show what it adds
  useEffect(() => setChatOpen(config.ai), [config.ai]);

  const tree = useMemo(() => sampleTree(config.openapi), [config.openapi]);
  const links: LinkItemType[] = [];
  if (config.blog) links.push({ url: "/blog", text: "Blog", active: "nested-url" });
  if (config.changelog) links.push({ url: "/changelog", text: "Changelog", active: "nested-url" });
  const layoutProps: BaseLayoutProps = {
    nav: { title: siteName(config), url: previewPath },
    links,
  };

  const aiChat: AIChatOptions | undefined = config.ai
    ? {
        open: chatOpen,
        onOpenChange: setChatOpen,
        panel: <AIChatPanel onClose={() => setChatOpen(false)} />,
        trigger: true,
      }
    : undefined;
  const tabs = config.tabs === "off" ? false : undefined;
  // the pages of the sample tree don't exist, nothing to prefetch
  const sidebar = { defaultOpenLevel: config.openLevel, prefetch: false };

  const operation = resolve(path, config)?.operation;
  const content = (
    <DocsPage
      key={path}
      toc={operation ? [] : guide.toc}
      full={operation !== undefined}
      tableOfContent={{ style: config.toc }}
      tableOfContentPopover={{ style: config.toc }}
    >
      <DocsTitle>{operation?.title ?? guide.title}</DocsTitle>
      <DocsDescription className={config.actions ? "mb-0" : undefined}>
        {operation?.description ?? guide.description}
      </DocsDescription>
      {config.actions && (
        <div className="flex flex-row items-center gap-2 border-b pt-2 pb-6">
          <MarkdownCopyButton markdownUrl="/docs.md" />
          <ViewOptionsPopover
            markdownUrl="/docs.md"
            githubUrl="https://github.com/fuma-nama/fumapress"
          />
        </div>
      )}
      <DocsBody>{operation ? <OperationBody operation={operation} /> : <GuideBody />}</DocsBody>
      {config.feedback && <Feedback key={path} />}
    </DocsPage>
  );

  // the open state of folders is kept per mount: remount when the default changes
  const key = `${config.layout}-${config.openLevel}`;
  return config.layout === "notebook" ? (
    <DocsLayoutNotebook
      key={key}
      {...layoutProps}
      tree={tree}
      tabs={tabs}
      tabMode={config.tabs === "top" ? "navbar" : "sidebar"}
      sidebar={sidebar}
      aiChat={aiChat}
    >
      {content}
    </DocsLayoutNotebook>
  ) : (
    <DocsLayoutDocs
      key={key}
      {...layoutProps}
      tree={tree}
      tabs={tabs}
      tabMode={config.tabs === "top" ? "top" : "auto"}
      sidebar={sidebar}
      aiChat={aiChat}
    >
      {content}
    </DocsLayoutDocs>
  );
}

/** the docs UI of a config the playground sends with `postMessage` */
export function PlaygroundPreview(): ReactNode {
  const [config, setConfig] = useState(defaultConfig);
  const [path, setPath] = useState(previewPath);

  useEffect(() => {
    const parent = window.parent;
    if (parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== parent) return;
      if (isPlaygroundMessage(event.data) && event.data.kind === "config")
        setConfig(event.data.config);
    };
    window.addEventListener("message", onMessage);
    parent.postMessage(
      { type: messageType, kind: "ready" } satisfies PlaygroundMessage,
      location.origin,
    );
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // a page that the config removed, like an API page without OpenAPI, goes back to the guide
  const current = resolve(path, config) ? path : previewPath;
  const route = useMemo<Route>(
    () => ({
      path: current,
      navigate(url) {
        const target = new URL(url, location.href);
        if (target.origin !== location.origin || !resolve(target.pathname, config)) return;
        setPath(target.pathname);
        window.scrollTo({ top: 0 });
      },
    }),
    [current, config],
  );
  const css = useMemo(() => themeCss(config.theme), [config.theme]);

  return (
    <RouteContext value={route}>
      <FrameworkProvider
        usePathname={usePathname}
        useParams={useParams}
        useRouter={useRouter}
        Link={RouteLink}
      >
        <div onClick={blockNavigation} className="contents">
          <style dangerouslySetInnerHTML={{ __html: css }} />
          <DocsPreview config={config} path={current} />
        </div>
      </FrameworkProvider>
    </RouteContext>
  );
}
