import type {
  AppShape,
  Awaitable,
  Context,
  LangEnv,
  PageView,
  Plugin,
  SourcePage,
} from "@fumapress/core";
import type { Page } from "fumadocs-core/source";
import { blogTranslations } from "./i18n";
import { BlogIndexView, BlogPostView, BlogTagsView, BlogTagView } from "./components/layouts";

export interface BlogAuthor {
  name: string;
  /** role or job title */
  title?: string;
  /** link to profile or website */
  url?: string;
  /** avatar URL */
  image?: string;
}

export interface BlogPluginOptions<C extends AppShape, S extends C["source"]> {
  /** the source keys of the posts; the plugin owns their pages */
  source: S | readonly S[];

  /** author registry, keyed by the ids used in posts */
  authors?: Record<string, BlogAuthor>;

  paths?: {
    /**
     * pathname for index page
     *
     * @default "/blog"
     */
    index?: string | false;

    /**
     * pathname for tags page
     *
     * @default "/blog/tags"
     */
    tags?: string | false;
  };

  /** tags of a post, the `tags` frontmatter when it returns `undefined` */
  getTags?: (this: Context<C>, page: SourcePage<C, S>) => Awaitable<string[] | undefined>;
  /** author ids of a post, the `authors` frontmatter when it returns `undefined` */
  getAuthors?: (this: Context<C>, page: SourcePage<C, S>) => Awaitable<string[] | undefined>;
  /** cover image URL of a post, the `image` frontmatter when it returns `undefined` */
  getImage?: (this: Context<C>, page: SourcePage<C, S>) => Awaitable<string | undefined>;
}

export interface TagInfo {
  /** the tag as written in the newest post using it */
  tag: string;
  /** the number of posts with it */
  count: number;
  /** its page, unless `paths.tags` is `false` */
  url?: string;
}

export interface BlogPost<P = Page> {
  page: P;
  /** creation date, from `getPageCreatedAt()` */
  date?: Date;
  /** ids missing from the `authors` option are shown by name only */
  authors: BlogAuthor[];
  tags: TagInfo[];
  /** cover image URL */
  image?: string;
}

export interface BlogIndexViewProps<P = Page> {
  posts: BlogPost<P>[];
  /** the tags page, unless `paths.tags` is `false` */
  tagsUrl?: string;
}

export interface BlogTagsViewProps {
  /** by post count */
  tags: TagInfo[];
  /** the index page, unless `paths.index` is `false` */
  indexUrl?: string;
}

export interface BlogTagViewProps<P = Page> {
  tag: TagInfo;
  posts: BlogPost<P>[];
  /** the index page, unless `paths.index` is `false` */
  indexUrl?: string;
}

export interface BlogPostViewProps<P = Page> {
  post: BlogPost<P>;
  /** the adjacent posts */
  newer?: BlogPost<P>;
  older?: BlogPost<P>;
  /** the index page, unless `paths.index` is `false` */
  indexUrl?: string;
}

export type BlogTypes<P, S extends string> = {
  views: {
    "blog.index": BlogIndexViewProps<P>;
    "blog.tags": BlogTagsViewProps;
    "blog.tag": BlogTagViewProps<P>;
  };
  pages: { [K in S]: BlogPostViewProps<P> };
};

/** the posts of `lang` of the blog of each site, by its context */
const sites = new WeakMap<object, (env: LangEnv<AppShape>) => Promise<BlogPost[]>>();

/** The posts of `lang` newest first, for custom pages like a landing page; `env` is optional without i18n. Requires `blogPlugin()`. */
export async function getBlogPosts<C extends AppShape>(
  ctx: Context<C>,
  ...[env]: [C["lang"]] extends [undefined] ? [env?: LangEnv<C>] : [env: LangEnv<C>]
): Promise<BlogPost<C["page"]>[]> {
  // hooks creating routes get a context inheriting from the site's
  for (let site: object | null = ctx; site; site = Object.getPrototypeOf(site)) {
    const getPosts = sites.get(site);
    // the posts are pages of the site of `ctx`, the registry is typed for any site
    if (getPosts) return getPosts({ lang: env?.lang }) as Promise<BlogPost<C["page"]>[]>;
  }
  throw new Error("[@fumapress/blog] getBlogPosts() requires blogPlugin()");
}

/** URL segment of a tag: lowercase, whitespace replaced by `-` */
function tagSlug(tag: string) {
  return tag.toLowerCase().replace(/\s+/g, "-");
}

/** `segment` under `path`, like a tag page under the tags page */
function joinPath(path: string, segment: string): string {
  return `${path.replace(/\/$/, "")}/${segment}`;
}

function strings(data: object, key: string): string[] | undefined {
  const value: unknown = Reflect.get(data, key);
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) return value;
}

/** Blog posts of the `source` keys, with index, tags and tag pages in every language. */
export function blogPlugin<
  C extends AppShape = AppShape,
  const S extends C["source"] = C["source"],
>(options: BlogPluginOptions<NoInfer<C>, S>): Plugin<C, BlogTypes<SourcePage<C, S>, S & string>> {
  type Post = SourcePage<C, S>;
  const { paths = {}, authors = {} } = options;
  const indexPath = paths.index ?? "/blog";
  const tagsPath = paths.tags ?? "/blog/tags";
  const source: readonly S[] = Array.isArray(options.source)
    ? options.source
    : [options.source as S];
  const isPost = (page: C["page"]): page is Post => source.includes(page.type as S);

  type LoaderOutput = Awaited<ReturnType<Context<C>["getLoader"]>>;
  // a content change replaces the loader output, every post and tag view reads the same collection
  const collections = new WeakMap<LoaderOutput, Map<C["lang"], ReturnType<typeof derive>>>();

  async function collect(ctx: Context<C>, lang: C["lang"]) {
    const loader = await ctx.getLoader();
    const byLang = collections.get(loader) ?? new Map<C["lang"], ReturnType<typeof derive>>();
    collections.set(loader, byLang);
    let collection = byLang.get(lang);
    if (!collection) {
      byLang.set(lang, (collection = derive(ctx, loader, lang)));
      // a later read tries again
      collection.catch(() => byLang.delete(lang));
    }
    return collection;
  }

  /** the posts of `lang` newest first, their tags and how to resolve a post */
  async function derive(ctx: Context<C>, loader: LoaderOutput, lang: C["lang"]) {
    const pending: Promise<{ page: Post; date?: Date; tags: string[] }>[] = [];
    for (const page of loader.getPages(lang)) {
      if (!isPost(page)) continue;
      pending.push(
        Promise.all([ctx.getPageCreatedAt(page), options.getTags?.call(ctx, page)]).then(
          ([date, tags]) => ({ page, date, tags: tags ?? strings(page.data, "tags") ?? [] }),
        ),
      );
    }
    const now = Date.now();
    const entries = (await Promise.all(pending)).sort(
      (a, b) => (b.date?.getTime() ?? now) - (a.date?.getTime() ?? now),
    );

    const tags = new Map<string, TagInfo>();
    for (const entry of entries) {
      for (const tag of entry.tags) {
        const slug = tagSlug(tag);
        const info = tags.get(slug);
        if (info) info.count++;
        else
          tags.set(slug, {
            tag,
            count: 1,
            url: tagsPath === false ? undefined : ctx.localizePath(lang, joinPath(tagsPath, slug)),
          });
      }
    }

    async function resolve({ page, date, tags: names }: (typeof entries)[number]) {
      const [ids, image] = await Promise.all([
        options.getAuthors?.call(ctx, page),
        options.getImage?.call(ctx, page),
      ]);
      const post: BlogPost<Post> = { page, date, authors: [], tags: [] };
      for (const id of ids ?? strings(page.data, "authors") ?? [])
        post.authors.push(authors[id] ?? { name: id });
      for (const name of new Set(names.map(tagSlug))) post.tags.push(tags.get(name)!);
      const cover: unknown = image ?? Reflect.get(page.data, "image");
      if (typeof cover === "string") post.image = cover;
      return post;
    }

    return {
      entries,
      tags,
      resolve,
      indexUrl: indexPath === false ? undefined : ctx.localizePath(lang, indexPath),
      tagsUrl: tagsPath === false ? undefined : ctx.localizePath(lang, tagsPath),
    };
  }

  return {
    name: "blog:main",
    configure() {
      sites.set(this, async ({ lang }) => {
        const { entries, resolve } = await collect(this, lang);
        return Promise.all(entries.map(resolve));
      });
    },
    translations: blogTranslations(),
    async routes({ createView }) {
      const render = this.getContentRender(source);
      for (const lang of this.languages) {
        if (indexPath !== false)
          createView({
            lang,
            path: indexPath,
            render,
            view: async () => {
              const { entries, resolve, tagsUrl } = await collect(this, lang);
              const props = { posts: await Promise.all(entries.map(resolve)), tagsUrl };
              return { type: "blog.index", props, node: <BlogIndexView {...props} /> };
            },
          });
        if (tagsPath === false) continue;

        const { tags } = await collect(this, lang);
        createView({
          lang,
          path: tagsPath,
          render,
          view: async () => {
            const { tags, indexUrl } = await collect(this, lang);
            const props = {
              tags: Array.from(tags.values()).sort((a, b) => b.count - a.count),
              indexUrl,
            };
            return { type: "blog.tags", props, node: <BlogTagsView {...props} /> };
          },
        });
        createView({
          lang,
          path: joinPath(tagsPath, "[tag]"),
          render,
          staticPaths: Array.from(tags.keys()),
          view: async ({ tag: slug }) => {
            if (typeof slug !== "string") return;
            const { entries, tags, resolve, indexUrl } = await collect(this, lang);
            const tag = tags.get(slug);
            if (!tag) return;
            const posts: Promise<BlogPost<Post>>[] = [];
            for (const entry of entries) {
              if (entry.tags.some((name) => tagSlug(name) === slug)) posts.push(resolve(entry));
            }
            const props = { tag, posts: await Promise.all(posts), indexUrl };
            return { type: "blog.tag", props, node: <BlogTagView {...props} /> };
          },
        });
      }
    },
    async getPageView(page, body) {
      if (!isPost(page)) return;
      if (!body)
        throw new Error(
          `[@fumapress/blog] the blog post "${page.path}" has no body, its content source doesn't render it.`,
        );
      const { entries, resolve, indexUrl } = await collect(this, page.locale as C["lang"]);
      const index = entries.findIndex((entry) => entry.page.url === page.url);
      const newer = entries[index - 1];
      const older = index === -1 ? undefined : entries[index + 1];
      const [post, newerPost, olderPost, toc] = await Promise.all([
        resolve(entries[index] ?? { page, tags: [] }),
        newer && resolve(newer),
        older && resolve(older),
        this.getPageToc(page),
      ]);
      const props: BlogPostViewProps<Post> = { post, newer: newerPost, older: olderPost, indexUrl };
      const view = {
        props,
        node: (
          <BlogPostView {...props} toc={toc}>
            {body.node}
          </BlogPostView>
        ),
      };
      // TS can't resolve `PageView` over a generic `S`, every key of it has these props
      return view as PageView<BlogTypes<Post, S & string>["pages"]>;
    },
  };
}
