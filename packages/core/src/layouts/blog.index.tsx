import { OrderedBlogGrid } from "@/components/blog";
import type { ConfigContext } from "@/config";
import { AllTagsLabel, BlogTitle } from "@/components/blog-labels";
import { cn } from "@/lib/cn";
import { joinPathname } from "@/lib/pathname";
import { getBlogContext, type BlogIndexPage } from "@/plugins/blog";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { ListIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "@/client";
import { getPressContext } from "@/lib/shared";

export interface BlogIndexPageOptions {
  heading?: ReactNode;
  description?: ReactNode;
}

export function createBlogIndexPage<C extends ConfigContext = ConfigContext>({
  heading,
  description,
}: BlogIndexPageOptions = {}): BlogIndexPage<C> {
  return async function BlogIndexPage({ lang }) {
    const ctx = getPressContext<C>();
    const { tagsPath, isBlog } = getBlogContext<C>();
    const source = await ctx.getLoader();

    return (
      <>
        <div className="flex flex-col gap-4 items-start border-2 border-dashed border-fd-primary rounded-xl bg-fd-primary/10 p-4 z-2 md:p-8">
          <h1 className="text-3xl font-semibold">{heading ?? <BlogTitle />}</h1>
          <p className="text-fd-primary overline decoration-fd-primary empty:hidden">
            {description}
          </p>
          {tagsPath !== false && (
            <Link
              href={lang ? joinPathname(lang, tagsPath) : tagsPath}
              className={cn(
                buttonVariants({
                  variant: "primary",
                }),
                "gap-2",
              )}
            >
              <ListIcon className="size-4" />
              <AllTagsLabel />
            </Link>
          )}
        </div>

        <OrderedBlogGrid<C> posts={source.getPages(lang).filter(isBlog.bind(ctx))} />
      </>
    );
  };
}
