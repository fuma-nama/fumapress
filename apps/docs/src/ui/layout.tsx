import type { ReactNode } from "react";
import { selectTreeRoot, type RenderPageProps, type SharedLayoutProps } from "fumapress";
import { DocsLayout } from "fumadocs-ui/layouts/notebook";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  PageLastUpdate,
} from "fumadocs-ui/layouts/notebook/page";
import { HomeLayout } from "fumadocs-ui/layouts/home";
import { getLayoutTabs, type LinkItemType } from "fumadocs-ui/layouts/shared";
import { SponsorsMarquee } from "@fumari/sponsors";
import { BookIcon, HistoryIcon, RssIcon } from "lucide-react";
import type { app } from "../../press.config";
import { frameworkOf } from "./framework";
import { Logo } from "./logo";

export const layoutProps: SharedLayoutProps = {
  nav: {
    title: (
      <>
        <Logo className="fp-logo size-9 -my-1 shrink-0" />
        <span className="font-serif text-xl font-normal">Fumapress</span>
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
  layoutProps,
  children,
}: {
  layoutProps: SharedLayoutProps;
  children: ReactNode;
}) {
  // the Home Layout takes these props, the others are for docs layouts
  const { nav, links = [], githubUrl, i18n, themeSwitch, searchToggle } = layoutProps;
  return (
    <HomeLayout
      {...{ nav, githubUrl, i18n, themeSwitch, searchToggle }}
      links={[...homeLinks, ...links]}
    >
      <div className="flex flex-col w-full max-w-[1400px] flex-1 px-4 py-6 mx-auto">{children}</div>
    </HomeLayout>
  );
}

function NotebookDocs({
  layoutProps: { tree, ...layoutProps },
  pageData,
  toc,
  body,
  slots,
}: RenderPageProps<typeof app, "docs" | "changelog">) {
  const docsTree = selectTreeRoot(tree, "docs");
  const actions: ReactNode[] = [];
  for (const slot of Object.values(slots))
    if (slot?.region === "actions") actions.push(slot.element);

  return (
    // the sidebar shows the docs on every page of this layout
    <DocsLayout
      {...layoutProps}
      tree={docsTree}
      tabs={getLayoutTabs(docsTree, {
        transform: (option) => ({
          ...option,
          icon: <span className={`${frameworkOf(option.url)}-tab tab-icon`}>{option.icon}</span>,
        }),
      })}
      containerProps={{ className: frameworkOf(pageData.url) }}
    >
      <DocsPage toc={toc} full={pageData.full} tableOfContent={{ footer: <SponsorsMarquee /> }}>
        <DocsTitle>{pageData.title}</DocsTitle>
        <DocsDescription className="mb-0">{pageData.description}</DocsDescription>
        <div className="flex flex-row gap-2 items-center border-b pt-2 pb-6">{actions}</div>
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
      return <HomeShell layoutProps={props.layoutProps}>{props.children}</HomeShell>;
    default:
      return renderDefault();
  }
}
