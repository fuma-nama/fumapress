import type { ConfigContext } from "@/config";
import { getCreationDate, type AppContext } from "@/lib/shared";
import path from "node:path";
import type { ComponentType, ReactNode } from "react";
import { Link } from "waku";

export interface BlogIndexPageOptions {
  heading?: ReactNode;
  description?: ReactNode;
}

export type BlogIndexPage<C extends ConfigContext = ConfigContext> = ComponentType<
  AppContext<C> & {
    lang?: string;
    indexPage: C["loaderConfig"]["page"];
    blogDir: string;
  }
>;

export function createBlogIndexPage<C extends ConfigContext = ConfigContext>({
  heading,
  description,
}: BlogIndexPageOptions = {}): BlogIndexPage<C> {
  return async function BlogIndexPage(props) {
    const { lang, getLoader, indexPage, blogDir } = props;
    const source = await getLoader();

    const currentDate = new Date(Date.now());
    const postPromises: Promise<{
      page: C["loaderConfig"]["page"];
      date: Date;
    }>[] = [];
    for (const page of source.getPages(lang)) {
      if (path.relative(blogDir, page.path).startsWith("..") || page === indexPage) continue;
      const datePromise = Promise.resolve(getCreationDate(props, page));
      postPromises.push(datePromise.then((date) => ({ page, date: date ?? currentDate })));
    }
    const posts = await Promise.all(postPromises);

    posts.sort((a, b) => b.date.getTime() - a.date.getTime());

    return (
      <>
        <div className="border-2 border-dashed border-fd-primary bg-fd-primary/10 p-4 z-2 md:p-8">
          <h1 className="text-3xl font-semibold">{heading ?? indexPage.data.title ?? "Blog"}</h1>
          <p className="mt-4 text-fd-primary overline decoration-fd-primary empty:hidden">
            {description ?? indexPage.data.description}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2 mt-4 md:grid-cols-3 xl:grid-cols-4">
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
      </>
    );
  };
}
