"use client";
import type { ComponentProps } from "react";
import { base, trailingSlash } from "astro:config/client";
import { usePathname, type Framework } from "fumadocs-core/framework";

type LinkProps = ComponentProps<NonNullable<Framework["Link"]>>;

const basePath = base.replace(/\/$/, "");

/** an `href` of the site, like `absoluteUrl()` of the context: with the base path, and a trailing slash for pages with `trailingSlash: 'always'` */
export function toHref(href: string): string {
  if (!href.startsWith("/") || href.startsWith("//")) return href;
  const end = href.search(/[?#]/);
  let path = end === -1 ? href : href.slice(0, end);
  path = path === "/" ? basePath || "/" : basePath + path;
  if (trailingSlash === "always" && !path.endsWith("/") && !/\.[^/]+$/.test(path)) path += "/";
  return end === -1 ? path : path + href.slice(end);
}

/** a link of the site, prerendering records it for the `build` of plugins like link validation */
export function Link({ href = "#", prefetch: _prefetch, ...props }: LinkProps) {
  const pathname = usePathname();
  const url = toHref(href);
  globalThis.FUMAPRESS_BUILD?.links.push({ href: url, fromPathname: pathname });
  return <a href={url} {...props} />;
}
