import type { Awaitable } from "@/lib/types";
import type { PressPlugin } from "@/app/plugin";
import type { AppContext, AppShape } from "@/app/context";
import { js2xml, type ElementCompact } from "xml-js";

/**
 * How frequently a page is likely to change.
 *
 * @see https://www.sitemaps.org/protocol.html#changefreqdef
 */
export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

/**
 * Last modification timestamp in W3C Datetime format (ISO 8601 subset).
 *
 * @see https://www.sitemaps.org/protocol.html#xmlDefinition
 */
export type SitemapLastMod = Date | string;

/**
 * Priority of a URL relative to other URLs on the site.
 *
 * Valid values are decimals between `0.0` and `1.0` inclusive.
 *
 * @see https://www.sitemaps.org/protocol.html#prioritydef
 */
export type SitemapPriority = number;

/**
 * `rel` attribute for sitemap link elements. The protocol only defines `alternate` for hreflang.
 *
 * @see https://www.sitemaps.org/protocol.html#xmlDefinition
 */
export type SitemapLinkRel = "alternate";

/**
 * An `xhtml:link` alternate language reference on a URL entry.
 *
 * @see https://www.sitemaps.org/protocol.html#xmlDefinition
 */
export interface SitemapAlternateLink {
  rel: SitemapLinkRel;
  /** BCP 47 language tag (e.g. `en`, `de`, `x-default`). */
  hreflang: string;
  /** Fully-qualified URL of the alternate page. */
  href: string;
}

/**
 * An `image:image` entry (Google image sitemap extension).
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps
 */
export interface SitemapImage {
  /** URL of the image. */
  loc: string;
  caption?: string;
  geo_location?: string;
  title?: string;
  license?: string;
}

/**
 * Publication metadata for a `news:news` entry (Google News sitemap extension).
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export interface SitemapNewsPublication {
  /** Publication name; must match Google News exactly if submitted there. */
  name: string;
  /** Primary language of the publication in ISO 639 format (two or three letter code). */
  language: string;
}

/**
 * A `news:news` entry (Google News sitemap extension).
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export interface SitemapNews {
  publication: SitemapNewsPublication;
  /** Publication date in W3C Datetime format. */
  publication_date: SitemapLastMod;
  /** Title of the news article. */
  title: string;
  /** Comma-separated stock tickers (optional). */
  stock_tickers?: string;
}

/**
 * A `video:video` entry (Google video sitemap extension).
 *
 * Only common fields are listed; see Google's schema for the full set.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
 */
export interface SitemapVideo {
  /** URL of the player page or direct link to the video. */
  content_loc?: string;
  /** URL of the player page for this video. */
  player_loc?: string;
  /** Whether the video may be embedded. */
  "player_loc@allow_embed"?: boolean;
  /** Whether to show a paywall to users from the given countries. */
  "player_loc@restrict"?: string;
  /** A URL pointing to the video thumbnail image. */
  thumbnail_loc: string;
  title: string;
  description: string;
  /** Duration in seconds (max 28800). */
  duration?: number;
  /** Expiration date in W3C Datetime format; omit if the video does not expire. */
  expiration_date?: SitemapLastMod;
  /** Rating value. 0.0–5.0 or unrated if omitted. */
  rating?: number;
  /** Number of times the video has been viewed. */
  view_count?: number;
  /** Publication date in W3C Datetime format. */
  publication_date?: SitemapLastMod;
  /** Whether the video is family friendly. */
  family_friendly?: "yes" | "no";
  /** Comma-separated list of tags. */
  tag?: string | string[];
  /** Comma-separated domains the video may not be played on. */
  restriction?: string;
  /** Whether search engines may download the video file. */
  "restriction@relationship"?: "allow" | "deny";
  gallery_loc?: string;
  /** Price currency in ISO 4217 format. */
  price?: string;
  "price@currency"?: string;
  "price@type"?: "rent" | "purchase" | "own" | "subscription";
  /** Platform restriction (e.g. `web`, `mobile`, `tv`). */
  platform?: string;
  "platform@relationship"?: "allow" | "deny";
  /** Whether a subscription is required. */
  requires_subscription?: "yes" | "no";
  uploader?: string;
  "uploader@info"?: string;
  live?: "yes" | "no";
}

/**
 * A single `<url>` entry in a sitemap.
 *
 * @see https://www.sitemaps.org/protocol.html#xmlDefinition
 */
export interface SitemapUrl {
  /**
   * Fully-qualified URL of the page.
   *
   * Must be less than 2,048 characters and include protocol + host per the spec.
   */
  loc: string;
  /**
   * Last modification date of the file.
   *
   * Search engines may use the full W3C Datetime or the date portion only.
   */
  lastmod?: SitemapLastMod;
  /**
   * Hint for how often the page changes.
   *
   * Note: The value is a hint, not a command.
   */
  changefreq?: SitemapChangeFrequency;
  /**
   * Priority relative to other URLs on your site (`0.0`–`1.0`).
   *
   * Default priority of pages is `0.5`; this does not affect comparison across different sites.
   */
  priority?: SitemapPriority;
  /**
   * Alternate language or regional URLs (`xhtml:link`).
   *
   * Requires the `xhtml` namespace on the root `urlset` when serialized.
   */
  alternates?: readonly SitemapAlternateLink[];
  /** Image URLs associated with this page (Google image extension). */
  images?: readonly SitemapImage[];
  /** Video metadata associated with this page (Google video extension). */
  videos?: readonly SitemapVideo[];
  /** News article metadata (Google News extension). */
  news?: readonly SitemapNews[];
}

export interface SitemapOptions<C extends AppShape = AppShape> {
  /**
   * Path for the sitemap route.
   *
   * @default "/sitemap.xml"
   */
  path?: string;

  /**
   * Customize or exclude sitemap entries.
   * Return `undefined` to exclude a page.
   */
  getEntry?: (this: AppContext<C>, page: C["page"]) => Awaitable<SitemapUrl | undefined>;

  /**
   * Additional entries to include in the sitemap, be careful the `loc` field must be a fully-qualified URL.
   */
  additionalEntries?: SitemapUrl[] | ((this: AppContext<C>) => Awaitable<SitemapUrl[]>);
}

function formatLastmod(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toISOString();
}

function imageToElement(image: SitemapImage): ElementCompact {
  const element: ElementCompact = {
    "image:loc": { _text: image.loc },
  };

  if (image.caption) element["image:caption"] = { _text: image.caption };
  if (image.geo_location) element["image:geo_location"] = { _text: image.geo_location };
  if (image.title) element["image:title"] = { _text: image.title };
  if (image.license) element["image:license"] = { _text: image.license };

  return element;
}

function entryToUrlElement(entry: SitemapUrl): ElementCompact {
  const url: ElementCompact = {
    loc: { _text: entry.loc },
  };

  if (entry.lastmod) {
    url.lastmod = { _text: formatLastmod(entry.lastmod) };
  }
  if (entry.changefreq) {
    url.changefreq = { _text: entry.changefreq };
  }
  if (entry.priority !== undefined) {
    url.priority = { _text: String(entry.priority) };
  }
  if (entry.alternates?.length) {
    url["xhtml:link"] = entry.alternates.map((alternate) => ({
      _attributes: {
        rel: alternate.rel,
        hreflang: alternate.hreflang,
        href: alternate.href,
      },
    }));
  }
  if (entry.images?.length) {
    url["image:image"] = entry.images.map(imageToElement);
  }

  return url;
}

function buildSitemap(entries: SitemapUrl[]) {
  return js2xml(
    {
      _declaration: {
        _attributes: {
          version: "1.0",
          encoding: "UTF-8",
        },
      },
      urlset: {
        _attributes: {
          xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
          "xmlns:xhtml": "http://www.w3.org/1999/xhtml",
          "xmlns:image": "http://www.google.com/schemas/sitemap-image/1.1",
        },
        url: entries.map(entryToUrlElement),
      },
    },
    { compact: true, spaces: 0 },
  );
}

export function sitemapPlugin<C extends AppShape = AppShape>(
  options: SitemapOptions<NoInfer<C>> = {},
): PressPlugin<C> {
  const {
    path = "/sitemap.xml",
    getEntry: _getEntry = async function getEntryDefault(page) {
      return {
        loc: new URL(page.url, this.siteConfig.baseUrl).href,
        lastmod: await this.getPageLastModified(page),
        priority: 0.8,
      };
    },
    additionalEntries,
  } = options;

  return {
    name: "core:sitemap",
    async createPages({ createApiIsomorphic, unstable_getCreated }) {
      const renderMode = this.mode === "default" ? "static" : this.mode;
      const getEntry = _getEntry.bind(this);

      createApiIsomorphic({
        render: renderMode,
        path,
        handler: async () => {
          const source = await this.getLoader();
          const entries: SitemapUrl[] = [];
          // avoid duplicated entries from `source.getPages()` & `getRouterConfigs()`
          const pageLocs = new Set<string>();

          for (const entry of await Promise.all(source.getPages().map(getEntry))) {
            if (!entry) continue;
            pageLocs.add(entry.loc);
            entries.push(entry);
          }

          for (const route of await unstable_getCreated().unstable_getRouterConfigs()) {
            if (route.isStatic && route.type === "route") {
              const segments = route.path.map((v) => v.name!);
              // exclude not-found pages
              if (segments.at(-1) === "404") continue;
              const loc = new URL("/" + segments.join("/"), this.siteConfig.baseUrl).href;
              if (pageLocs.has(loc)) continue;

              entries.push({ loc, priority: 1 });
            }
          }

          if (additionalEntries) {
            entries.push(
              ...(typeof additionalEntries === "function"
                ? await additionalEntries.call(this)
                : additionalEntries),
            );
          }

          return new Response(buildSitemap(entries), {
            headers: {
              "Content-Type": "application/xml",
            },
          });
        },
      });
    },
  };
}
