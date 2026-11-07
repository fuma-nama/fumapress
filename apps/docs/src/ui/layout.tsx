import type { ReactNode } from "react";
import { selectTreeRoot, type BaseOptions, type RenderPageProps } from "fumapress";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  PageLastUpdate,
  ViewOptionsPopover,
} from "fumadocs-ui/layouts/notebook/page";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { getLayoutTabs, type LinkItemType } from "fumadocs-ui/layouts/shared";
import { SponsorsMarquee } from "@fumari/sponsors";
import { BookIcon, HistoryIcon, RssIcon } from "lucide-react";
import type { app } from "../../press.config";
import { frameworkOf } from "./framework";
import { Logo } from "./logo";

export const baseOptions: BaseOptions = {
  nav: {
    title: (
      <>
        <Logo className="fp-logo size-9 -my-1 shrink-0" />
        <span className="fp-title text-[21px] font-normal tracking-[-0.01em]">Fumapress</span>
      </>
    ),
  },
};

const homeLinks: LinkItemType[] = [
  { url: "/docs", text: "Documentation", icon: <BookIcon />, active: "nested-url" },
  { url: "/blog", text: "Blog", icon: <RssIcon />, active: "nested-url" },
  { url: "/changelog", text: "Changelog", icon: <HistoryIcon />, active: "nested-url" },
  { url: "https://fuma-nama.dev/sponsors", text: "Sponsors", external: true },
];

/** the landing, blog and changelog pages */
export function HomeShell({
  baseOptions,
  children,
}: {
  baseOptions: BaseOptions;
  children: ReactNode;
}) {
  return (
    <HomeLayout {...baseOptions} links={[...homeLinks, ...(baseOptions.links ?? [])]}>
      <div
        data-fd-home-layout-container=""
        className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto"
      >
        {children}
      </div>
    </HomeLayout>
  );
}

function NotebookDocs({
  tree,
  baseOptions,
  pageData,
  body,
  actions,
}: RenderPageProps<typeof app, "docs" | "changelog">) {
  const docsTree = selectTreeRoot(tree, "docs");

  return (
    // the sidebar shows the docs on every page of this layout
    <DocsLayout
      {...baseOptions}
      tree={docsTree}
      tabs={getLayoutTabs(docsTree, {
        transform: (option) => ({
          ...option,
          icon: <span className={`${frameworkOf(option.url)}-tab tab-icon`}>{option.icon}</span>,
        }),
      })}
      containerProps={{ className: frameworkOf(pageData.url) }}
    >
      <DocsPage
        toc={pageData.toc}
        full={pageData.full}
        tableOfContent={{ footer: <SponsorsMarquee /> }}
      >
        <DocsTitle>{pageData.title}</DocsTitle>
        <DocsDescription className="mb-0">{pageData.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">
          {pageData.markdownUrl && <MarkdownCopyButton markdownUrl={pageData.markdownUrl} />}
          <ViewOptionsPopover markdownUrl={pageData.markdownUrl} githubUrl={pageData.githubUrl} />
          {Object.values(actions)}
        </div>
        <DocsBody>{body}</DocsBody>
        {pageData.lastModified && <PageLastUpdate date={pageData.lastModified} />}
      </DocsPage>
    </DocsLayout>
  );
}

export function renderPage(props: RenderPageProps<typeof app>) {
  // taken before the switch: once every type has a case, `props` is `never` in `default`
  const { renderDefault } = props;
  switch (props.type) {
    case "docs":
    case "changelog":
      return <NotebookDocs {...props} />;
    case "blog":
    case "blog.index":
    case "blog.tags":
    case "blog.tag":
    case "changelog.index":
      return <HomeShell baseOptions={props.baseOptions}>{props.children}</HomeShell>;
    default:
      return renderDefault();
  }
}
