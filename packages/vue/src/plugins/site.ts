import type { Plugin } from "../core/plugin";
import type { HeadTag } from "../core/types";

/** the head tags and layout props a site has from its `site` config: the last plugin, so any other wins over it */
export function sitePlugin(): Plugin {
  return {
    name: "core:site",
    head({ page, pathname, data }) {
      const { site } = this;
      const description = data?.description ?? site.description;

      const tags: HeadTag[] = [
        { tag: "title", content: [data?.title, site.name].filter(Boolean).join(" | ") },
      ];
      if (description) {
        tags.push({ tag: "meta", attrs: { name: "description", content: description } });
      }
      if (site.baseUrl) {
        const href = this.absoluteUrl(page?.url ?? pathname);
        tags.push({ tag: "link", attrs: { rel: "canonical", href } });
      }
      // the page in its other languages, for search engines
      for (const { lang, url } of page ? this.getPageAlternates(page) : []) {
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
