import { ConfigContext } from "@/config";
import { cn } from "@/lib/cn";
import { joinPathname } from "@/lib/join-pathname";
import { AppContext, getCreationDate } from "@/lib/shared";
import { BlogContext } from "@/plugins/blog";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { CornerLeftUpIcon } from "lucide-react";
import { Link } from "waku";

export function BlogItem<C extends ConfigContext>({
  page,
  date,
}: {
  page: C["loaderConfig"]["page"];
  date: Date;
}) {
  return (
    <Link
      to={page.url}
      className="flex flex-col bg-fd-card rounded-2xl border shadow-sm p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <p className="font-medium">{page.data.title}</p>
      <p className="text-sm text-fd-muted-foreground">{page.data.description}</p>

      <p className="mt-auto pt-4 text-xs text-fd-primary">{date.toDateString()}</p>
    </Link>
  );
}

export async function OrderedBlogGrid<C extends ConfigContext>({
  posts,
  ctx,
}: {
  posts: C["loaderConfig"]["page"][];
  ctx: AppContext<C>;
}) {
  const currentDate = new Date(Date.now());
  const orderedPosts: { page: C["loaderConfig"]["page"]; date: Date }[] = [];

  for (const page of posts) {
    const date = await getCreationDate(ctx, page);
    orderedPosts.push({ page, date: date ?? currentDate });
  }

  orderedPosts.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="grid grid-cols-1 gap-2 mt-4 md:grid-cols-3 xl:grid-cols-4">
      {orderedPosts.map(({ page, date }) => (
        <BlogItem key={page.url} page={page} date={date} />
      ))}
    </div>
  );
}

export function LinkToHome<C extends ConfigContext>({
  lang,
  blog,
}: {
  blog: BlogContext<C>;
  lang?: string;
}) {
  if (!blog.indexPath) return;

  return (
    <Link
      to={lang ? joinPathname(lang, blog.indexPath) : blog.indexPath}
      className={cn(
        buttonVariants({
          variant: "ghost",
          className: "text-fd-muted-foreground gap-2",
        }),
      )}
    >
      <CornerLeftUpIcon className="size-3.5" />
      Back to Home
    </Link>
  );
}
