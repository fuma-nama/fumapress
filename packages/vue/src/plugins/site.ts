import { pageTitle } from "../core/head";
import type { Plugin } from "../core/plugin";
import type { HeadTag } from "../core/types";

/** the head tags and layout props a site has from its `site` config: the last plugin, so any other wins over it */
export function sitePlugin(): Plugin {
  return {
    name: "core:site",
    head({ page, pathname, pageData }) {
      const { site } = this;
      const description = pageData?.description ?? site.description;

      const tags: HeadTag[] = [{ tag: "title", content: pageTitle(pageData?.title, site.name) }];
      if (description) {
        tags.push({ tag: "meta", attrs: { name: "description", content: description } });
      }
      if (site.baseUrl) {
        // a page shown in the fallback language is the page of that language
        const own = page && (this.getFallbackOrigin(page) ?? page);
        const href = this.absoluteUrl(own?.url ?? pathname);
        tags.push({ tag: "link", attrs: { rel: "canonical", href } });
      }
      // the page in its other languages, for search engines
      const alternates = page ? this.getPageAlternates(page) : this.getViewAlternates(pathname);
      for (const { lang, url } of alternates) {
        tags.push({
          tag: "link",
          attrs: { rel: "alternate", hreflang: lang, href: this.absoluteUrl(url) },
        });
      }
      return tags;
    },
    layoutProps({ lang }) {
      const { name, git } = this.site;
      return {
        nav: { title: name, url: this.localizePath(lang, "/") },
        githubUrl: git ? `https://github.com/${git.user}/${git.repo}` : undefined,
      };
    },
  };
}
