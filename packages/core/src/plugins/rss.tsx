import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import type { AppContext, AppShape } from "@/app/context";
import { js2xml, type ElementCompact } from "xml-js";

/**
 * An `<item>` entry of the RSS feed.
 *
 * @see https://www.rssboard.org/rss-specification#hrelementsOfLtitemgt
 */
export interface RSSItem {
  title: string;

  /** fully-qualified URL of the item */
  link: string;

  description?: string;

  /** publication date of the item */
  pubDate?: Date | string;

  /**
   * unique identifier of the item
   *
   * @default link
   */
  guid?: string;

  /** email address of the author */
  author?: string;

  categories?: string[];
}

export interface RSSOptions<C extends AppShape = AppShape> {
  /**
   * path of the RSS route
   *
   * @default "/rss.xml"
   */
  path?: string;

  /** title of the feed, defaults to site name */
  title?: string;

  /** description of the feed, RSS requires one — defaults to the feed title */
  description?: string;

  /** language of the feed (e.g. `en-us`) */
  language?: string;

  /**
   * max number of items in the feed
   *
   * @default 20
   */
  limit?: number;

  /**
   * add a `<link rel="alternate">` tag to root meta for feed discovery
   *
   * @default true
   */
  alternateLink?: boolean;

  /**
   * Customize or exclude feed items, return `undefined` to exclude a page.
   *
   * By default, includes pages with a creation date (or modified date as fallback), resolved from adapters.
   */
  getItem?: (this: AppContext<C>, page: C["page"]) => Awaitable<RSSItem | undefined>;

  /** Additional items to include in the feed, be careful the `link` field must be a fully-qualified URL. */
  additionalItems?: RSSItem[] | ((this: AppContext<C>) => Awaitable<RSSItem[]>);
}

function formatDate(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toUTCString();
}

function toTime(value: Date | string | undefined) {
  if (value === undefined) return 0;
  return (value instanceof Date ? value : new Date(value)).getTime();
}

function itemToElement(item: RSSItem): ElementCompact {
  const element: ElementCompact = {
    title: { _text: item.title },
    link: { _text: item.link },
    guid: { _text: item.guid ?? item.link },
  };

  if (item.description) element.description = { _text: item.description };
  if (item.pubDate) element.pubDate = { _text: formatDate(item.pubDate) };
  if (item.author) element.author = { _text: item.author };
  if (item.categories?.length) {
    element.category = item.categories.map((category) => ({ _text: category }));
  }

  return element;
}

export interface RSSChannel {
  title: string;
  /** fully-qualified URL of the site */
  link: string;
  description: string;
  language?: string;
  /** fully-qualified URL of the feed itself */
  selfUrl?: string;
  items: RSSItem[];
}

export function buildRSS(channel: RSSChannel): string {
  const element: ElementCompact = {
    title: { _text: channel.title },
    link: { _text: channel.link },
    description: { _text: channel.description },
  };

  if (channel.language) element.language = { _text: channel.language };
  const lastBuild = channel.items.reduce((acc, item) => Math.max(acc, toTime(item.pubDate)), 0);
  if (lastBuild > 0) element.lastBuildDate = { _text: formatDate(new Date(lastBuild)) };
  if (channel.selfUrl) {
    element["atom:link"] = {
      _attributes: {
        href: channel.selfUrl,
        rel: "self",
        type: "application/rss+xml",
      },
    };
  }
  element.item = channel.items.map(itemToElement);

  return js2xml(
    {
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "UTF-8",
        },
      },
      rss: {
        _attributes: {
          version: "2.0",
          "xmlns:atom": "http://www.w3.org/2005/Atom",
        },
        channel: element,
      },
    },
    { compact: true, spaces: 0 },
  );
}

export function rssPlugin<C extends AppShape = AppShape>(
  options: RSSOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const {
    path = "/rss.xml",
    title,
    description,
    language,
    limit = 20,
    alternateLink = true,
    getItem: _getItem = async function getItemDefault(page) {
      const date = (await this.getPageCreatedAt(page)) ?? (await this.getPageLastModified(page));
      // only include dated pages, so edits don't flood the feed with undated noise
      if (!date) return;

      return {
        title: page.data.title ?? page.path,
        description: page.data.description,
        link: new URL(page.url, this.siteConfig.baseUrl).href,
        pubDate: date,
      };
    },
    additionalItems,
  } = options;

  return {
    name: "core:rss",
    init() {
      if (!alternateLink) return;

      this.interceptRootMeta(({ next }) => (
        <>
          <link
            rel="alternate"
            type="application/rss+xml"
            title={title ?? this.siteConfig.name}
            href={path}
          />
          {next()}
        </>
      ));
    },
    async createPages({ createApiIsomorphic }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const getItem = _getItem.bind(this);

      createApiIsomorphic({
        render: renderMode,
        path,
        handler: async () => {
          const source = await this.getLoader();
          const items = (await Promise.all(source.getPages().map(getItem))).filter(
            (item) => item !== undefined,
          );

          if (additionalItems) {
            items.push(
              ...(typeof additionalItems === "function"
                ? await additionalItems.call(this)
                : additionalItems),
            );
          }

          items.sort((a, b) => toTime(b.pubDate) - toTime(a.pubDate));

          const channelTitle = title ?? this.siteConfig.name;
          return new Response(
            buildRSS({
              title: channelTitle,
              link: this.siteConfig.baseUrl ?? "/",
              description: description ?? channelTitle,
              language,
              selfUrl: this.siteConfig.baseUrl
                ? new URL(path, this.siteConfig.baseUrl).href
                : undefined,
              items: items.slice(0, limit),
            }),
            {
              headers: {
                "Content-Type": "application/rss+xml",
              },
            },
          );
        },
      });
    },
  };
}
