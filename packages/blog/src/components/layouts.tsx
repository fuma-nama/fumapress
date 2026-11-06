import { T } from "@fuma-translate/react";
import { cn } from "cn";
import { Image, Link } from "fumadocs-core/framework";
import type { TOCItemType } from "fumadocs-core/toc";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CornerLeftUpIcon,
  ListIcon,
  NewspaperIcon,
  TagIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import type {
  BlogAuthor,
  BlogIndexViewProps,
  BlogPost,
  BlogPostViewProps,
  BlogTagsViewProps,
  BlogTagViewProps,
} from "../plugin";
import { TOCProvider } from "fumadocs-ui/components/toc";
import { BlogPanel } from "./panel.client";

/** text of the index, tags and tag pages, defaults to translated UI strings */
export interface BlogViewOptions {
  heading?: ReactNode;
  description?: ReactNode;
}

/** a post, its content is `children` */
export function BlogPostView({
  post,
  newer,
  older,
  indexUrl,
  toc = [],
  children,
}: BlogPostViewProps & { toc?: TOCItemType[]; children: ReactNode }) {
  const { page, date, authors, tags } = post;

  return (
    <TOCProvider toc={toc}>
      <div className="border-y px-4 pt-3.5 pb-6 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
        <div className="flex flex-col gap-4 w-full mx-auto max-w-[900px]">
          <LinkToHome href={indexUrl} className="w-fit" />

          <h1 className="font-semibold text-2xl">{page.data.title}</h1>
          <p className="text-fd-muted-foreground empty:hidden">{page.data.description}</p>
          {authors.length > 0 && (
            <div className="flex flex-row flex-wrap items-start gap-x-6 gap-y-2">
              {authors.map((author) => (
                <BlogAuthorItem key={author.name} author={author} />
              ))}
            </div>
          )}
          {(tags.length > 0 || date) && (
            <div className="mt-2 flex flex-row flex-wrap items-center gap-2">
              {tags.length > 0 && (
                <>
                  <TagIcon className="size-4 text-fd-muted-foreground" />
                  {tags.map(({ tag, url }) => {
                    const shared =
                      "px-1.5 py-0.5 rounded-lg text-sm text-fd-primary-foreground bg-fd-primary font-mono";
                    if (url === undefined)
                      return (
                        <p key={tag} className={shared}>
                          {tag}
                        </p>
                      );
                    return (
                      <Link key={tag} href={url} className={shared}>
                        {tag}
                      </Link>
                    );
                  })}
                </>
              )}

              {date && (
                <BlogDate date={date} className="ms-auto text-xs text-fd-muted-foreground" />
              )}
            </div>
          )}
        </div>
      </div>
      <article className="prose mt-6 mx-auto w-full max-w-[900px]">{children}</article>
      {(newer || older) && (
        <nav className="grid gap-2 mt-8 mx-auto w-full max-w-[900px] sm:grid-cols-2">
          {newer && (
            <AdjacentPostLink post={newer}>
              <ChevronLeftIcon className="size-3.5" />
              <T text="Newer post" note="blog post navigation" />
            </AdjacentPostLink>
          )}
          {older && (
            <AdjacentPostLink post={older} className="sm:col-start-2 sm:items-end">
              <T text="Older post" note="blog post navigation" />
              <ChevronRightIcon className="size-3.5" />
            </AdjacentPostLink>
          )}
        </nav>
      )}

      <div className="h-12" />
      <BlogPanel />
    </TOCProvider>
  );
}

export function BlogIndexView({
  posts,
  tagsUrl,
  heading,
  description,
}: BlogIndexViewProps & BlogViewOptions) {
  return (
    <>
      <div className="flex flex-col gap-4 items-start border-2 border-dashed border-fd-primary rounded-xl bg-fd-primary/10 p-4 z-2 md:p-8">
        <h1 className="text-3xl font-semibold">{heading ?? <T text="Blog" note="blog" />}</h1>
        <p className="text-fd-primary overline decoration-fd-primary empty:hidden">{description}</p>
        {tagsUrl !== undefined && (
          <Link href={tagsUrl} className={cn(buttonVariants({ variant: "primary" }), "gap-2")}>
            <ListIcon className="size-4" />
            <T text="All Tags" note="blog tags page" />
          </Link>
        )}
      </div>

      <BlogGrid posts={posts} />
    </>
  );
}

export function BlogTagsView({
  tags,
  indexUrl,
  heading,
  description,
}: BlogTagsViewProps & BlogViewOptions) {
  return (
    <>
      <div className="flex flex-col items-start gap-4 border-y px-4 pt-3.5 pb-6 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
        <LinkToHome href={indexUrl} />
        <h1 className="font-semibold text-2xl">
          {heading ?? <T text="All Tags" note="blog tags page" />}
        </h1>
        <p className="text-fd-muted-foreground empty:hidden">
          {description ?? (
            <span className="flex items-center gap-1">
              <TagIcon className="size-3.5 text-fd-primary" />
              <T
                text="{count} tags in total."
                note="blog tags page"
                variables={{ count: String(tags.length) }}
              />
            </span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 md:grid-cols-4 xl:grid-cols-6">
        {tags.map(({ tag, count, url }) => (
          <Link
            key={tag}
            href={url}
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
}

/** a tag and its posts */
export function BlogTagView({
  tag: { tag },
  posts,
  indexUrl,
  heading,
  description,
}: BlogTagViewProps & BlogViewOptions) {
  return (
    <>
      <div className="flex flex-col items-start gap-4 border-y p-4 pt-3.5 bg-fd-card text-fd-card-foreground shadow-inner max-sm:-mx-4 sm:rounded-xl sm:border">
        <LinkToHome href={indexUrl} />
        <h1 className="font-semibold text-2xl">
          {heading ?? (
            <span className="inline-flex gap-2 items-center">
              <TagIcon className="text-fd-primary size-6" />
              <T text='Tag "{tag}"' note="blog tag page" variables={{ tag }} />
            </span>
          )}
        </h1>
        <p className="text-fd-muted-foreground empty:hidden">
          {description ?? (
            <span className="inline-flex items-center gap-1">
              <NewspaperIcon className="text-fd-primary size-3.5" />
              <T
                text="{count} matching blog posts."
                note="blog tag page"
                variables={{ count: String(posts.length) }}
              />
            </span>
          )}
        </p>
      </div>

      <BlogGrid posts={posts} />
    </>
  );
}

function BlogDate({ date, ...props }: { date: Date } & ComponentProps<"time">) {
  return (
    <time dateTime={date.toISOString()} {...props}>
      {date.toDateString()}
    </time>
  );
}

function BlogItem({ post: { page, date, image, authors } }: { post: BlogPost }) {
  return (
    <Link
      href={page.url}
      className="group flex flex-col overflow-hidden bg-fd-card rounded-2xl border shadow-sm transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
    >
      {image && (
        <Image
          src={image}
          alt=""
          sizes="(min-width: 1280px) 25vw, (min-width: 768px) 33vw, 100vw"
          loading="lazy"
          className="w-full aspect-video object-cover"
        />
      )}
      <div className="flex flex-col flex-1 p-4">
        <p className="font-medium">{page.data.title}</p>
        <p className="text-sm text-fd-muted-foreground">{page.data.description}</p>

        <div className="flex flex-row items-center mt-auto pt-4">
          {authors.map(
            (author) =>
              author.image && (
                <Image
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

function BlogGrid({ posts }: { posts: BlogPost[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 mt-4 md:grid-cols-3 xl:grid-cols-4">
      {posts.map((post) => (
        <BlogItem key={post.page.url} post={post} />
      ))}
    </div>
  );
}

function LinkToHome({ href, className }: { href?: string; className?: string }) {
  if (href === undefined) return;

  return (
    <Link
      href={href}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "text-fd-muted-foreground gap-2 -mx-2",
        className,
      )}
    >
      <CornerLeftUpIcon className="size-3.5" />
      <T text="Back to Home" note="blog" />
    </Link>
  );
}

function BlogAuthorItem({ author }: { author: BlogAuthor }) {
  const className = "inline-flex items-center gap-2 text-sm";
  const content = (
    <>
      {author.image && (
        <Image
          src={author.image}
          alt=""
          width={28}
          height={28}
          loading="lazy"
          className="size-7 rounded-full"
        />
      )}
      <span className="flex flex-col leading-tight">
        <span className="font-medium">{author.name}</span>
        {author.title && <span className="text-xs text-fd-muted-foreground">{author.title}</span>}
      </span>
    </>
  );

  if (!author.url) return <span className={className}>{content}</span>;
  return (
    <a href={author.url} className={cn(className, "transition-colors hover:text-fd-primary")}>
      {content}
    </a>
  );
}

function AdjacentPostLink({
  post,
  className,
  children,
}: {
  post: BlogPost;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={post.page.url}
      className={cn(
        "flex flex-col gap-1 bg-fd-card text-fd-card-foreground rounded-xl border p-4 transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1 text-xs text-fd-muted-foreground">
        {children}
      </span>
      <span className="font-medium">{post.page.data.title}</span>
    </Link>
  );
}
