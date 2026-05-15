import { ConfigContext } from "@/config";
import { AppContext } from "@/lib/shared";
import { Awaitable } from "@/lib/types";
import { ReactNode } from "react";
import { Link } from "waku";

export interface BlogIndexPageOptions<C extends ConfigContext = ConfigContext> {
  heading?: ReactNode;
  description?: ReactNode;
  getBlogDate?: (
    this: AppContext<C>,
    page: C["loaderConfig"]["page"],
  ) => Awaitable<Date | undefined>;
}

export function createBlogIndexPage<C extends ConfigContext = ConfigContext>({
  heading = "Blog",
  description,
  getBlogDate = async function (page) {
    for (const adapter of this.adapters) {
      const d = await adapter["core:get-creation-date"]?.call(this, page);
      if (d) return d;
    }
  },
}: BlogIndexPageOptions<C> = {}) {
  return async function BlogIndexPage(props: AppContext<C> & { lang?: string }) {
    const { lang, getLoader } = props;
    const source = await getLoader();

    const currentDate = new Date(Date.now());
    const posts = await Promise.all(
      source.getPages(lang).map(async (page) => ({
        page,
        date: (await getBlogDate.call(props, page)) ?? currentDate,
      })),
    );

    posts.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
      <main className="mx-auto w-full px-4 pb-12 md:py-12">
        <div className="mb-4 aspect-[3.2] p-8 z-2 md:p-12">
          <h1 className="mb-4 text-3xl font-medium">{heading}</h1>
          <p className="text-sm text-fd-muted-foreground empty:hidden">{description}</p>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-4">
          {posts.map(({ page: post, date }) => (
            <Link
              key={post.url}
              to={post.url}
              className="flex flex-col bg-fd-card rounded-2xl border shadow-sm p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
            >
              <p className="font-medium">{post.data.title}</p>
              <p className="text-sm text-fd-muted-foreground">{post.data.description}</p>

              <p className="mt-auto pt-4 text-xs text-fd-primary">{date.toDateString()}</p>
            </Link>
          ))}
        </div>
      </main>
    );
  };
}
