import { ConfigContext } from "@/config";
import { cn } from "@/lib/cn";
import { getCreationDate, getPressContext } from "@/lib/shared";
import { getBlogContext } from "@/plugins/blog";
import { Link } from "@/client";
import { T } from "@fuma-translate/react";
import { CornerLeftUpIcon } from "lucide-react";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { joinPathname } from "@/lib/pathname";

export function BlogItem<C extends ConfigContext>({ page, date }: { page: C["page"]; date: Date }) {
  return (
    <Link
      href={page.url}
      className="flex flex-col bg-fd-card rounded-2xl border shadow-sm p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      <p className="font-medium">{page.data.title}</p>
      <p className="text-sm text-fd-muted-foreground">{page.data.description}</p>

      <p className="mt-auto pt-4 text-xs text-fd-primary">{date.toDateString()}</p>
    </Link>
  );
}

export async function OrderedBlogGrid<C extends ConfigContext>({ posts }: { posts: C["page"][] }) {
  const ctx = getPressContext<C>();
  const currentDate = new Date(Date.now());
  const orderedPosts: { page: C["page"]; date: Date }[] = [];

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

export function LinkToHome({ lang }: { lang?: string }) {
  const { indexPath } = getBlogContext();
  if (!indexPath) return;

  return (
    <Link
      href={lang ? joinPathname(lang, indexPath) : indexPath}
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
