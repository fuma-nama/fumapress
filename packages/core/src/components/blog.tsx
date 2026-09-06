import { cn } from "@/lib/cn";
import { getPressContext, type AppShape } from "@/app/context";
import { getBlogAuthors, getBlogContext, type BlogPost } from "@/plugins/blog";
import { getImage } from "@/lib/shared/blog";
import { Link } from "@/client";
import { T } from "@fuma-translate/react";
import { CornerLeftUpIcon } from "lucide-react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import type { ComponentProps } from "react";

export function BlogDate({ date, ...props }: { date: Date } & ComponentProps<"time">) {
  return (
    <time dateTime={date.toISOString()} {...props}>
      {date.toDateString()}
    </time>
  );
}

export async function BlogItem<C extends AppShape>({ page, date }: BlogPost<C>) {
  const ctx = getPressContext<C>();
  const [image, authors] = await Promise.all([getImage(ctx, page), getBlogAuthors(ctx, page)]);

  return (
    <Link
      href={page.url}
      className="group flex flex-col overflow-hidden bg-fd-card rounded-2xl border shadow-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      {image && (
        <img src={image} alt="" loading="lazy" className="w-full aspect-video object-cover" />
      )}
      <div className="flex flex-col flex-1 p-4">
        <p className="font-medium">{page.data.title}</p>
        <p className="text-sm text-fd-muted-foreground">{page.data.description}</p>

        <div className="flex flex-row items-center mt-auto pt-4">
          {authors.map(
            (author) =>
              author.image && (
                <img
                  key={author.name}
                  src={author.image}
                  alt={author.name}
                  title={author.name}
                  width={24}
                  height={24}
                  loading="lazy"
                  className="size-6 rounded-full border-2 border-fd-card -ms-2 first:ms-0 group-hover:border-fd-accent"
                />
              ),
          )}
          {date && <BlogDate date={date} className="ms-auto text-xs text-fd-primary" />}
        </div>
      </div>
    </Link>
  );
}

/** render posts in the given order, see `getBlogPosts()` */
export function BlogGrid<C extends AppShape>({ posts }: { posts: BlogPost<C>[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 mt-4 md:grid-cols-3 xl:grid-cols-4">
      {posts.map((post) => (
        <BlogItem<C> key={post.page.url} {...post} />
      ))}
    </div>
  );
}

export function LinkToHome({ lang }: { lang?: string }) {
  const { indexPath } = getBlogContext();
  if (!indexPath) return;

  return (
    <Link
      href={getPressContext().localizePath(lang, indexPath)}
      className={cn(
        buttonVariants({
          variant: "ghost",
          className: "text-fd-muted-foreground gap-2",
        }),
      )}
    >
      <CornerLeftUpIcon className="size-3.5" />
      <T text="Back to Home" note="blog" />
    </Link>
  );
}
