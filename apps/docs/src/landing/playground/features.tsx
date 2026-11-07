/**
 * The UI of plugins in the preview. `@fumapress/ai` and `@fumapress/feedback` need their API routes and styles, which the
 * preview doesn't have, so these copy their markup and answer with sample data.
 */
import { useState, type SyntheticEvent } from "react";
import Link from "fumadocs-core/link";
import { buttonVariants } from "fumadocs-ui/components/ui/button";
import { Collapsible, CollapsibleContent } from "fumadocs-ui/components/ui/collapsible";
import {
  ArrowUpIcon,
  MessageCircleIcon,
  SearchIcon,
  SquarePenIcon,
  ThumbsDown,
  ThumbsUp,
  XIcon,
} from "lucide-react";
import { cn } from "../../cn";
import { previewPath } from "./options";
import { href } from "./sample";

/* AI chat: `AIChatAction` of `@fumapress/ai`, and the panel of `@fumadocs/ai-chat` */

/** the `ai` page action */
export function AskAIButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onClick}
      className={buttonVariants({
        variant: "secondary",
        size: "sm",
        className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground",
      })}
    >
      <MessageCircleIcon aria-hidden />
      Ask AI
    </button>
  );
}

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: { title: string; url: string }[];
}

const sampleChat: Message[] = [
  { role: "user", text: "How do I create a customer?" },
  {
    role: "assistant",
    text: "Call `acme.customers.create()` with an email address. The email must be unique in your account, and the call returns the new customer with its ID.",
    sources: [
      { title: "Quick Start", url: previewPath },
      { title: "Create Customer", url: href("api/customers/create") },
    ],
  },
];

const previewAnswer: Message = {
  role: "assistant",
  text: "This preview answers with sample text. On your site, the chat searches your pages and answers with links to them.",
};

/** inline code of an answer, as the Markdown of the chat renders it */
function Text({ text }: { text: string }) {
  return (
    <p className="text-sm leading-relaxed">
      {text.split(/(`[^`]+`)/).map((part, i) =>
        part.startsWith("`") ? (
          <code
            key={i}
            className="rounded border bg-fd-muted px-1 py-0.5 font-mono text-[0.8125rem]"
          >
            {part.slice(1, -1)}
          </code>
        ) : (
          part
        ),
      )}
    </p>
  );
}

export function AIChatPanel({ onClose }: { onClose: () => void }) {
  const [messages, setMessages] = useState(sampleChat);
  const [input, setInput] = useState("");

  function submit(event: SyntheticEvent) {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((messages) => [...messages, { role: "user", text }, previewAnswer]);
    setInput("");
  }

  return (
    <div className="flex size-full flex-col">
      <div className="flex h-12 shrink-0 items-center gap-0.5 ps-3 pe-1.5">
        <p className="flex-1 truncate text-sm text-fd-muted-foreground">AI chat</p>
        <button
          type="button"
          aria-label="New chat"
          onClick={() => setMessages([])}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <SquarePenIcon />
        </button>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
        >
          <XIcon />
        </button>
      </div>
      <div className="fd-scroll-container min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col gap-8 px-3 pt-2 pb-6">
          {messages.length === 0 && (
            <div className="mt-auto flex flex-col">
              <p className="text-lg font-medium tracking-tight">What do you want to know?</p>
              <p className="mt-1 text-sm text-fd-muted-foreground">
                Answers come from the pages of this site.
              </p>
            </div>
          )}
          {messages.map((message, i) =>
            message.role === "user" ? (
              <div key={i} className="flex justify-end">
                <p className="max-w-[85%] rounded-xl bg-fd-secondary px-3 py-1.5 text-sm whitespace-pre-wrap text-fd-secondary-foreground">
                  {message.text}
                </p>
              </div>
            ) : (
              <div key={i} className="flex flex-col gap-3">
                {message.sources && (
                  <p className="flex items-center gap-2 text-sm text-fd-muted-foreground">
                    <SearchIcon className="size-3.5" />
                    Searched
                    <span className="text-xs text-fd-muted-foreground/75 tabular-nums">
                      {message.sources.length} results
                    </span>
                  </p>
                )}
                <Text text={message.text} />
                {message.sources && (
                  <div className="flex flex-wrap gap-1.5">
                    {message.sources.map((source, j) => (
                      <Link
                        key={source.url}
                        href={source.url}
                        className="flex h-7 max-w-56 items-center gap-1.5 rounded-lg border bg-fd-card ps-1.5 pe-2 text-xs text-fd-muted-foreground transition-colors hover:bg-fd-accent hover:text-fd-accent-foreground"
                      >
                        <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-md bg-fd-secondary px-1 font-mono text-[10.5px] tabular-nums">
                          {j + 1}
                        </span>
                        <span className="truncate">{source.title}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ),
          )}
        </div>
      </div>
      <form
        onSubmit={submit}
        className="mx-3 mb-3 flex items-end gap-1 rounded-lg border bg-fd-popover p-1.5 text-fd-popover-foreground shadow-lg shadow-black/5"
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question"
          aria-label="Message"
          className="h-7 min-w-0 flex-1 bg-transparent px-1.5 text-sm outline-none placeholder:text-fd-muted-foreground"
        />
        <button
          type="submit"
          aria-label="Send"
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-fd-primary text-fd-primary-foreground transition-colors disabled:opacity-50"
          disabled={input.trim().length === 0}
        >
          <ArrowUpIcon className="size-4" />
        </button>
      </form>
    </div>
  );
}

/* Feedback: `Feedback` of `@fumapress/feedback`, the `feedback` footer */

const rateButton =
  "inline-flex items-center gap-2 px-3 py-2 rounded-full font-medium border text-sm [&_svg]:size-4 disabled:cursor-not-allowed";

export function Feedback() {
  const [opinion, setOpinion] = useState<"good" | "bad" | null>(null);
  const [submitted, setSubmitted] = useState<"good" | "bad" | null>(null);
  const [message, setMessage] = useState("");
  const active = submitted ?? opinion;

  function submit(event?: SyntheticEvent) {
    event?.preventDefault();
    if (opinion === null) return;
    setSubmitted(opinion);
    setOpinion(null);
    setMessage("");
  }

  return (
    <Collapsible
      open={opinion !== null || submitted !== null}
      onOpenChange={(open) => {
        if (!open) setOpinion(null);
      }}
      className="border-y py-3"
    >
      <div className="flex flex-row items-center gap-2">
        <p className="pe-2 text-sm font-medium">How is this guide?</p>
        {(["good", "bad"] as const).map((value) => (
          <button
            key={value}
            type="button"
            disabled={submitted !== null}
            onClick={() => setOpinion(value)}
            className={cn(
              rateButton,
              active === value
                ? "bg-fd-accent text-fd-accent-foreground [&_svg]:fill-current"
                : "text-fd-muted-foreground",
            )}
          >
            {value === "good" ? <ThumbsUp /> : <ThumbsDown />}
            {value === "good" ? "Good" : "Bad"}
          </button>
        ))}
      </div>
      <CollapsibleContent className="mt-3">
        {submitted ? (
          <div className="flex flex-col items-center gap-3 rounded-xl bg-fd-card px-3 py-6 text-center text-sm text-fd-muted-foreground">
            <p>Thank you for your feedback!</p>
            <button
              type="button"
              className={cn(buttonVariants({ color: "secondary" }), "text-xs")}
              onClick={() => {
                setOpinion(submitted);
                setSubmitted(null);
              }}
            >
              Submit Again
            </button>
          </div>
        ) : (
          <form className="flex flex-col gap-3" onSubmit={submit}>
            <textarea
              required
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="resize-none rounded-lg border bg-fd-secondary p-3 text-fd-secondary-foreground placeholder:text-fd-muted-foreground focus-visible:outline-none"
              placeholder="Leave your feedback..."
              onKeyDown={(event) => {
                if (!event.shiftKey && event.key === "Enter") submit(event);
              }}
            />
            <button
              type="submit"
              className={cn(buttonVariants({ color: "outline" }), "w-fit px-3")}
            >
              Submit
            </button>
          </form>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
