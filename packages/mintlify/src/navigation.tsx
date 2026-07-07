import type { Folder, Item, Node, Root } from "fumadocs-core/page-tree";
import type { ReactNode } from "react";
import { renderMintlifyIcon } from "./icons";
import type {
  MintlifyAnchor,
  MintlifyDropdown,
  MintlifyGroup,
  MintlifyIcon,
  MintlifyMenuItem,
  MintlifyNavEntry,
  MintlifyNavigation,
  MintlifyProduct,
  MintlifyTab,
  MintlifyVersionNav,
  MintlifyLanguageNav,
} from "./schema";

export interface ResolveNavigationOptions {
  /** Mintlify locale for language-specific navigation */
  language?: string;
  /** Active version slug prefix for page lookup */
  version?: string;
  /** Docs collection folder name inside `content/`. Default: `docs` */
  docsDir?: string;
}

export interface PageMatchOptions {
  docsDir?: string;
  version?: string;
}

interface NavContainer {
  pages?: MintlifyNavEntry[];
  groups?: MintlifyGroup[];
  tabs?: MintlifyTab[];
  anchors?: MintlifyAnchor[];
  dropdowns?: MintlifyDropdown[];
  products?: MintlifyProduct[];
  menu?: MintlifyMenuItem[];
  languages?: MintlifyNavigation["languages"];
  versions?: MintlifyVersionNav[];
}

type NavigationSection = Partial<NavContainer>;

let nodeId = 0;

function nextId(prefix: string) {
  nodeId += 1;
  return `mintlify:${prefix}:${nodeId}`;
}

export function normalizeMintPath(pagePath: string) {
  return pagePath
    .replace(/^\//, "")
    .replace(/^content\/(?:docs\/)?/, "")
    .replace(/^docs\//, "")
    .replace(/\.(mdx?|md)$/, "");
}

function versionFolderSlug(version: string) {
  return version
    .trim()
    .toLowerCase()
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-");
}

async function icon(value: MintlifyIcon | undefined): Promise<ReactNode> {
  return renderMintlifyIcon(value);
}

function withTag(name: string, tag: string | undefined): ReactNode {
  if (!tag) return name;

  return (
    <>
      {name}
      <span
        style={{
          marginInlineStart: "0.5rem",
          borderRadius: "9999px",
          backgroundColor: "color-mix(in srgb, var(--color-fd-primary) 10%, transparent)",
          color: "var(--color-fd-primary)",
          padding: "0.125rem 0.5rem",
          fontSize: "0.75em",
          fontWeight: 500,
        }}
      >
        {tag}
      </span>
    </>
  );
}

export function createPageIndex(root: Root): Map<string, Item> {
  const map = new Map<string, Item>();

  function add(key: string, item: Item) {
    if (!map.has(key)) map.set(key, item);
  }

  function walk(nodes: Node[]) {
    for (const node of nodes) {
      if (node.type === "page") {
        if (typeof node.$ref === "string") {
          const ref = normalizeMintPath(node.$ref);
          add(ref, node);
          const base = ref.split("/").pop();
          if (base) add(base, node);
        }
        continue;
      }

      if (node.type === "folder") {
        if (node.index && typeof node.index.$ref === "string") {
          const ref = normalizeMintPath(node.index.$ref);
          add(ref, node.index);
        }
        walk(node.children);
      }
    }
  }

  walk(root.children);
  return map;
}

function pagePathCandidates(pagePath: string, options: PageMatchOptions = {}) {
  const normalized = normalizeMintPath(pagePath);
  const docsDir = options.docsDir ?? "docs";
  const candidates = new Set<string>([normalized]);

  if (options.version) {
    candidates.add(`${versionFolderSlug(options.version)}/${normalized}`);
  }

  if (!normalized.startsWith(`${docsDir}/`)) {
    candidates.add(`${docsDir}/${normalized}`);
  }

  if (options.version) {
    candidates.add(`${versionFolderSlug(options.version)}/${docsDir}/${normalized}`);
  }

  return [...candidates];
}

function findPage(
  pagePath: string,
  pageIndex: Map<string, Item>,
  options: PageMatchOptions = {},
): Item | undefined {
  for (const candidate of pagePathCandidates(pagePath, options)) {
    const page = pageIndex.get(candidate);
    if (page) return page;
  }

  const normalized = normalizeMintPath(pagePath);
  const suffix = normalized.split("/").pop() ?? normalized;
  return (
    pageIndex.get(suffix) ??
    [...pageIndex.entries()].find(([key]) => key.endsWith(`/${normalized}`))?.[1]
  );
}

function buildExternalPage(name: ReactNode, href: string, icon?: ReactNode): Item {
  return {
    $id: nextId("external"),
    type: "page",
    name,
    url: href,
    external: true,
    icon,
  };
}

async function buildGroupFolder(
  group: MintlifyGroup,
  pageIndex: Map<string, Item>,
  options: PageMatchOptions,
): Promise<Folder | undefined> {
  if (group.hidden) return undefined;

  const children: Node[] = [];
  for (const entry of group.pages ?? []) {
    const node = await buildNavEntry(entry, pageIndex, options);
    if (node) children.push(node);
  }

  if (children.length === 0 && !group.root) return undefined;

  const folder: Folder = {
    $id: nextId("group"),
    type: "folder",
    name: withTag(group.group, group.tag),
    icon: await icon(group.icon),
    defaultOpen: group.expanded,
    children,
    $ref: { folder: normalizeMintPath(group.root ?? group.group) },
  };

  if (group.root) {
    const index = findPage(group.root, pageIndex, options);
    if (index) folder.index = index;
  }

  return folder;
}

async function buildNavEntry(
  entry: MintlifyNavEntry,
  pageIndex: Map<string, Item>,
  options: PageMatchOptions,
): Promise<Node | undefined> {
  if (typeof entry === "string") {
    const page = findPage(entry, pageIndex, options);
    if (page) return page;

    if (/^https?:\/\//.test(entry)) {
      return buildExternalPage(entry, entry);
    }

    console.warn(`[Fumapress Mintlify] Page not found in content source: ${entry}`);
    return undefined;
  }

  return buildGroupFolder(entry, pageIndex, options);
}

async function buildSection(
  name: ReactNode,
  container: NavigationSection,
  pageIndex: Map<string, Item>,
  options: PageMatchOptions,
  icon?: ReactNode,
  href?: string,
): Promise<Node | undefined> {
  if (href) {
    return buildExternalPage(name, href, icon);
  }

  const children = await buildNavigationChildren(container, pageIndex, options);
  if (children.length === 0) return undefined;

  const folder: Folder = {
    $id: nextId("section"),
    type: "folder",
    name,
    icon,
    children,
  };

  if (typeof name === "string") {
    folder.$ref = { folder: name.toLowerCase().replace(/\s+/g, "-") };
  }

  return folder;
}

async function buildNavigationChildren(
  container: NavigationSection,
  pageIndex: Map<string, Item>,
  options: PageMatchOptions,
): Promise<Node[]> {
  const nodes: Node[] = [];

  if (container.pages) {
    for (const entry of container.pages) {
      const node = await buildNavEntry(entry, pageIndex, options);
      if (node) nodes.push(node);
    }
  }

  if (container.groups) {
    for (const group of container.groups) {
      const node = await buildGroupFolder(group, pageIndex, options);
      if (node) nodes.push(node);
    }
  }

  if (container.menu) {
    for (const item of container.menu) {
      if (item.hidden) continue;
      const node = await buildSection(
        item.item,
        item,
        pageIndex,
        options,
        await icon(item.icon),
        item.href,
      );
      if (node) nodes.push(node);
    }
  }

  if (container.tabs) {
    for (const tab of container.tabs) {
      if (tab.hidden) continue;
      const node = await buildSection(
        tab.tab,
        tab,
        pageIndex,
        options,
        await icon(tab.icon),
        tab.href,
      );
      if (node) nodes.push(node);
    }
  }

  if (container.anchors) {
    for (const anchor of container.anchors) {
      if (anchor.hidden) continue;
      const node = await buildSection(
        anchor.anchor,
        anchor,
        pageIndex,
        options,
        await icon(anchor.icon),
        anchor.href,
      );
      if (node) nodes.push(node);
    }
  }

  if (container.dropdowns) {
    for (const dropdown of container.dropdowns) {
      if (dropdown.hidden) continue;
      const node = await buildSection(
        dropdown.dropdown,
        dropdown,
        pageIndex,
        options,
        await icon(dropdown.icon),
        dropdown.href,
      );
      if (node) nodes.push(node);
    }
  }

  if (container.products) {
    for (const product of container.products) {
      if (product.hidden) continue;
      const node = await buildSection(
        product.name ?? product.product,
        product,
        pageIndex,
        options,
        await icon(product.icon),
        product.href,
      );
      if (node) nodes.push(node);
    }
  }

  return nodes;
}

function pickLanguage(
  languages: MintlifyNavigation["languages"],
  language?: string,
): NavigationSection | undefined {
  if (!languages?.length) return undefined;

  return (
    languages.find((item: MintlifyLanguageNav) => item.language === language) ??
    languages.find((item: MintlifyLanguageNav) => item.default) ??
    languages[0]
  );
}

export function resolveNavigationContainer(
  navigation: MintlifyNavigation,
  options: ResolveNavigationOptions = {},
): NavContainer {
  let container: NavContainer = navigation;

  const language = pickLanguage(container.languages, options.language);
  if (language) container = language;

  return container;
}

async function buildVersionRootFolder(
  version: MintlifyVersionNav,
  pageIndex: Map<string, Item>,
  options: ResolveNavigationOptions,
): Promise<Folder | undefined> {
  if (version.hidden) return undefined;

  const matchOptions: PageMatchOptions = {
    docsDir: options.docsDir,
    version: version.version,
  };

  const children = await buildNavigationChildren(version, pageIndex, matchOptions);
  if (children.length === 0) return undefined;

  return {
    $id: nextId("version"),
    type: "folder",
    name: withTag(version.version, version.tag),
    root: true,
    defaultOpen: version.default,
    children,
    $ref: { folder: versionFolderSlug(version.version) },
  };
}

export async function buildPageTreeFromNavigation(
  navigation: MintlifyNavigation,
  pageIndex: Map<string, Item>,
  options: ResolveNavigationOptions = {},
): Promise<Node[]> {
  nodeId = 0;
  const container = resolveNavigationContainer(navigation, options);
  const matchOptions: PageMatchOptions = { docsDir: options.docsDir };

  if (container.versions?.length) {
    const folders: Folder[] = [];
    for (const version of container.versions) {
      const node = await buildVersionRootFolder(version, pageIndex, options);
      if (node) folders.push(node);
    }
    return folders;
  }

  return buildNavigationChildren(container, pageIndex, matchOptions);
}

export function getMintlifyVersions(navigation: MintlifyNavigation): MintlifyVersionNav[] {
  const container = resolveNavigationContainer(navigation, {});
  return container.versions ?? [];
}

/**
 * Collect every page path referenced from navigation (all languages, versions,
 * tabs, ...), normalized with {@link normalizeMintPath}.
 *
 * Used to implement `seo.indexing: "navigable"`.
 */
export function getNavigablePages(navigation: MintlifyNavigation): Set<string> {
  const pages = new Set<string>();

  function walkEntries(entries: MintlifyNavEntry[] | undefined) {
    for (const entry of entries ?? []) {
      if (typeof entry === "string") {
        if (!/^https?:\/\//.test(entry)) pages.add(normalizeMintPath(entry));
        continue;
      }

      if (entry.root) pages.add(normalizeMintPath(entry.root));
      walkEntries(entry.pages);
    }
  }

  function walkContainer(container: NavigationSection | undefined) {
    if (!container) return;
    walkEntries(container.pages);
    for (const group of container.groups ?? []) walkEntries([group]);
    for (const tab of container.tabs ?? []) walkContainer(tab);
    for (const anchor of container.anchors ?? []) walkContainer(anchor);
    for (const dropdown of container.dropdowns ?? []) walkContainer(dropdown);
    for (const product of container.products ?? []) walkContainer(product);
    for (const item of container.menu ?? []) walkContainer(item);
    for (const language of container.languages ?? []) walkContainer(language);
    for (const version of container.versions ?? []) walkContainer(version);
  }

  walkContainer(navigation);
  walkContainer(navigation.global as NavigationSection | undefined);
  return pages;
}
