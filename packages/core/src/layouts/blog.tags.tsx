import { LinkToHome, OrderedBlogGrid } from "@/components/blog";
import type { ConfigContext } from "@/config";
import { cn } from "@/lib/cn";
import { joinPathname } from "@/lib/join-pathname";
import { getTags, groupTags } from "@/lib/shared/blog";
import { BlogTagPage, BlogTagsPage } from "@/plugins/blog";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ListIcon, NewspaperIcon, TagIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "waku";

export interface BlogTagsPageOptions {
  heading?: ReactNode;
  description?: ReactNode;
}

export function createBlogTagsPage<C extends ConfigContext = ConfigContext>({
  heading,
  description,
}: BlogTagsPageOptions = {}): BlogTagsPage<C> {
  return async function BlogTagsPage({ lang, blog, ctx }) {
    const source = await ctx.getLoader();

    const blogPosts = source.getPages(lang).filter((page) => blog.isBlog.call(ctx, page));
    const grouped = await groupTags(ctx, blogPosts);

    return (
      <>
        <div className="flex flex-col items-start gap-4 border-y px-4 pt-3.5 pb-6 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
          <LinkToHome lang={lang} blog={blog} />
          <h1 className="font-semibold text-2xl">{heading ?? "All Tags"}</h1>
          <p className="text-fd-muted-foreground empty:hidden">
            {description ?? (
              <span className="flex items-center gap-1">
                <TagIcon className="size-3.5 text-fd-primary" />
                <span className="text-fd-primary font-mono">{grouped.size}</span> tags in total.
              </span>
            )}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 md:grid-cols-4 xl:grid-cols-6">
          {Array.from(grouped.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([tag, count]) => (
              <Link
                key={tag}
                to={`/blog/tags/${tag}`}
                className="flex flex-row items-center gap-2 bg-fd-card text-fd-card-foreground border font-mono rounded-lg px-2 py-1 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
              >
                <TagIcon className="size-3.5 text-fd-muted-foreground" />
                <p className="font-medium">{tag}</p>
                <p className="ms-auto text-sm text-fd-muted-foreground">{count}</p>
              </Link>
            ))}
        </div>
      </>
    );
  };
}

export function createBlogTagPage<C extends ConfigContext = ConfigContext>({
  heading,
  description,
}: BlogTagsPageOptions = {}): BlogTagPage<C> {
  return async function BlogTagsPage({ lang, tag, blog, ctx }) {
    const source = await ctx.getLoader();

    const posts: C["loaderConfig"]["page"][] = [];
    for (const page of source.getPages(lang)) {
      if (!blog.isBlog.call(ctx, page)) continue;
      const tags = await getTags(ctx, page);
      if (!tags || !tags.includes(tag)) continue;

      posts.push(page);
    }

    return (
      <>
        <div className="flex flex-col items-start gap-4 border-y p-4 pt-3.5 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
          <LinkToHome lang={lang} blog={blog} />
          <h1 className="font-semibold text-2xl">
            {heading ?? (
              <span className="inline-flex gap-2 items-center">
                <TagIcon className="text-fd-primary size-6" />
                Tag <span className="font-mono text-fd-primary">"{tag}"</span>
              </span>
            )}
          </h1>
          <p className="text-fd-muted-foreground empty:hidden">
            {description ?? (
              <span className="inline-flex items-center gap-1">
                <NewspaperIcon className="text-fd-primary size-3.5" />
                <span className="font-mono text-fd-primary">{posts.length}</span> matching blog
                posts.
              </span>
            )}
          </p>
        </div>

        <OrderedBlogGrid posts={posts} ctx={ctx} />
      </>
    );
  };
}
