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
 * A `video:video` entry (Google video sitemap extension).
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/video-sitemaps
 */
export interface SitemapVideo {
  /** URL of the video thumbnail image. */
  thumbnail_loc: string;
  title: string;
  description: string;
  /** URL of the video file, at least one of `content_loc` and `player_loc` is required. */
  content_loc?: string;
  /** URL of the player page for this video. */
  player_loc?: string | { loc: string; allow_embed?: boolean };
  /** Duration in seconds (1–28800). */
  duration?: number;
  /** Date after which the video is no longer available. */
  expiration_date?: SitemapLastMod;
  /** Rating from 0.0 to 5.0. */
  rating?: number;
  view_count?: number;
  publication_date?: SitemapLastMod;
  family_friendly?: boolean;
  /** Up to 32 tags, one `video:tag` element each. */
  tag?: string | string[];
  /** Show or hide the video in search results from the given countries (ISO 3166). */
  restriction?: { relationship: "allow" | "deny"; countries: string[] };
  /** Show or hide the video on the given platforms. */
  platform?: { relationship: "allow" | "deny"; platforms: ("web" | "mobile" | "tv")[] };
  price?: { value: number; currency: string; type?: "rent" | "own" };
  requires_subscription?: boolean;
  uploader?: string | { name: string; info?: string };
  /** Whether the video is a live stream. */
  live?: boolean;
}

/**
 * A `news:news` entry (Google News sitemap extension), at most one per URL.
 *
 * @see https://developers.google.com/search/docs/crawling-indexing/sitemaps/news-sitemap
 */
export interface SitemapNews {
  publication: {
    /** Publication name, matching its name on news.google.com. */
    name: string;
    /** Language code (ISO 639). */
    language: string;
  };
  publication_date: SitemapLastMod;
  /** Title of the news article. */
  title: string;
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
  /** Videos on this page (Google video extension). */
  videos?: readonly SitemapVideo[];
  /** News article metadata (Google News extension). */
  news?: SitemapNews;
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

function yesNo(value: boolean) {
  return { _text: value ? "yes" : "no" };
}

function videoToElement(video: SitemapVideo): ElementCompact {
  const element: ElementCompact = {
    "video:thumbnail_loc": { _text: video.thumbnail_loc },
    "video:title": { _text: video.title },
    "video:description": { _text: video.description },
  };

  if (video.content_loc) element["video:content_loc"] = { _text: video.content_loc };
  if (typeof video.player_loc === "string") {
    element["video:player_loc"] = { _text: video.player_loc };
  } else if (video.player_loc) {
    element["video:player_loc"] = {
      ...(video.player_loc.allow_embed !== undefined && {
        _attributes: { allow_embed: video.player_loc.allow_embed ? "yes" : "no" },
      }),
      _text: video.player_loc.loc,
    };
  }
  if (video.duration !== undefined) element["video:duration"] = { _text: String(video.duration) };
  if (video.expiration_date)
    element["video:expiration_date"] = { _text: formatLastmod(video.expiration_date) };
  if (video.rating !== undefined) element["video:rating"] = { _text: String(video.rating) };
  if (video.view_count !== undefined)
    element["video:view_count"] = { _text: String(video.view_count) };
  if (video.publication_date)
    element["video:publication_date"] = { _text: formatLastmod(video.publication_date) };
  if (video.family_friendly !== undefined)
    element["video:family_friendly"] = yesNo(video.family_friendly);
  if (video.restriction) {
    element["video:restriction"] = {
      _attributes: { relationship: video.restriction.relationship },
      _text: video.restriction.countries.join(" "),
    };
  }
  if (video.platform) {
    element["video:platform"] = {
      _attributes: { relationship: video.platform.relationship },
      _text: video.platform.platforms.join(" "),
    };
  }
  if (video.price) {
    element["video:price"] = {
      _attributes: {
        currency: video.price.currency,
        ...(video.price.type && { type: video.price.type }),
      },
      _text: String(video.price.value),
    };
  }
  if (video.requires_subscription !== undefined)
    element["video:requires_subscription"] = yesNo(video.requires_subscription);
  if (typeof video.uploader === "string") {
    element["video:uploader"] = { _text: video.uploader };
  } else if (video.uploader) {
    element["video:uploader"] = {
      ...(video.uploader.info && { _attributes: { info: video.uploader.info } }),
      _text: video.uploader.name,
    };
  }
  if (video.live !== undefined) element["video:live"] = yesNo(video.live);
  if (video.tag) {
    const tags = typeof video.tag === "string" ? [video.tag] : video.tag;
    element["video:tag"] = tags.map((tag) => ({ _text: tag }));
  }

  return element;
}

function newsToElement(news: SitemapNews): ElementCompact {
  return {
    "news:publication": {
      "news:name": { _text: news.publication.name },
      "news:language": { _text: news.publication.language },
    },
    "news:publication_date": { _text: formatLastmod(news.publication_date) },
    "news:title": { _text: news.title },
  };
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
  if (entry.videos?.length) {
    url["video:video"] = entry.videos.map(videoToElement);
  }
  if (entry.news) {
    url["news:news"] = newsToElement(entry.news);
  }

  return url;
}

export function buildSitemap(entries: SitemapUrl[]): string {
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
          "xmlns:video": "http://www.google.com/schemas/sitemap-video/1.1",
          "xmlns:news": "http://www.google.com/schemas/sitemap-news/0.9",
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
        loc: this.siteConfig.baseUrl ? new URL(page.url, this.siteConfig.baseUrl).href : page.url,
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
              const pathname = "/" + segments.join("/");
              const loc = this.siteConfig.baseUrl
                ? new URL(pathname, this.siteConfig.baseUrl).href
                : pathname;
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
