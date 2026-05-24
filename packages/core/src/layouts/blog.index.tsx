import { OrderedBlogGrid } from "@/components/blog";
import type { ConfigContext } from "@/config";
import { I18nLabel } from "@/components/i18n";
import { cn } from "@/lib/cn";
import { joinPathname } from "@/lib/join-pathname";
import type { BlogIndexPage } from "@/plugins/blog";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ListIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "waku";

export interface BlogIndexPageOptions {
  heading?: ReactNode;
  description?: ReactNode;
}

export function createBlogIndexPage<C extends ConfigContext = ConfigContext>({
  heading,
  description,
}: BlogIndexPageOptions = {}): BlogIndexPage<C> {
  return async function BlogIndexPage({ lang, blog, ctx }) {
    const source = await ctx.getLoader();

    return (
      <>
        <div className="flex flex-col gap-4 items-start border-2 border-dashed border-fd-primary rounded-xl bg-fd-primary/10 p-4 z-2 md:p-8">
          <h1 className="text-3xl font-semibold">{heading ?? <I18nLabel label="blog" />}</h1>
          <p className="text-fd-primary overline decoration-fd-primary empty:hidden">
            {description}
          </p>
          {blog.tagsPath !== false && (
            <Link
              to={lang ? joinPathname(lang, blog.tagsPath) : blog.tagsPath}
              className={cn(
                buttonVariants({
                  variant: "primary",
                }),
                "gap-2",
              )}
            >
              <ListIcon className="size-4" />
              <I18nLabel label="allTags" />
            </Link>
          )}
        </div>

        <OrderedBlogGrid posts={source.getPages(lang).filter(blog.isBlog.bind(ctx))} ctx={ctx} />
      </>
    );
  };
}
