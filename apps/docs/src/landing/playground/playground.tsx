"use client";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { cn } from "../../cn";
import { Jack } from "../plugs";
import {
  codeFiles,
  defaultConfig,
  isPlaygroundMessage,
  messageType,
  previewPath,
  siteName,
  type PlaygroundConfig,
  type PlaygroundMessage,
  type FeatureId,
  type ThemeId,
} from "./options";
import { tokenize, type TokenKind } from "./tokens";
import { glass, percentOf } from "./device-rect";

/** the desktop viewport the preview renders at, scaled down to the width of its frame */
const viewport = { width: 1280, height: 800 };

/** how long the lines of the last change stay marked */
const markDuration = 1500;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Choice<V> {
  value: V;
  label: string;
}

const layoutChoices: Choice<PlaygroundConfig["layout"]>[] = [
  { value: "docs", label: "Docs" },
  { value: "notebook", label: "Notebook" },
];

const tabsChoices: Choice<PlaygroundConfig["tabs"]>[] = [
  { value: "sidebar", label: "Sidebar" },
  { value: "top", label: "Top" },
  { value: "off", label: "Off" },
];

const folderChoices: Choice<PlaygroundConfig["openLevel"]>[] = [
  { value: 0, label: "Closed" },
  { value: 1, label: "Open" },
];

const tocChoices: Choice<PlaygroundConfig["toc"]>[] = [
  { value: "normal", label: "Normal" },
  { value: "clerk", label: "Clerk" },
  { value: "block", label: "Block" },
];

/** the primary color of each theme, light and dark, from its CSS file */
const themes: (Choice<ThemeId> & { light: string; dark: string })[] = [
  { value: "neutral", label: "Neutral", light: "hsl(0, 0%, 9%)", dark: "hsl(0, 0%, 98%)" },
  { value: "ocean", label: "Ocean", light: "hsl(210, 80%, 20.2%)", dark: "hsl(205, 100%, 85%)" },
  { value: "purple", label: "Purple", light: "hsl(270, 100%, 52%)", dark: "hsl(270, 100%, 86%)" },
  { value: "emerald", label: "Emerald", light: "hsl(168, 70%, 40%)", dark: "hsl(168, 70%, 60%)" },
  { value: "ruby", label: "Ruby", light: "hsl(348, 85%, 45%)", dark: "hsl(348, 90%, 62%)" },
];

const namePresets = ["Acme Docs", "Orbit", "Paperwork", "Northwind API"];

/** colors of `washi.css`, as `code.ts` maps them */
const inkColors: Record<TokenKind, string> = {
  plain: "var(--w-code-fg)",
  comment: "var(--w-code-comment)",
  keyword: "var(--w-code-keyword)",
  string: "var(--w-code-string)",
  function: "var(--w-code-function)",
  constant: "var(--w-code-constant)",
  tag: "var(--w-code-constant)",
  punctuation: "var(--w-code-punctuation)",
};

const focusRing =
  "outline-none focus-visible:outline-[1.5px] focus-visible:outline-offset-2 focus-visible:outline-(--w-ink)";
/** the ink fill of a selected control, as `.w-button` */
const inkFill = "bg-(--w-label) text-[#f1eee7] [.dark_&]:bg-(--w-ink) [.dark_&]:text-(--w-paper)";

/** `Sheet` of `ink.tsx`, kept here so the client bundle doesn't take the drawings of the page */
function Sheet({
  children,
  className,
  wrapperClassName,
}: {
  children: ReactNode;
  className?: string;
  wrapperClassName?: string;
}) {
  return (
    <div className={cn("relative", wrapperClassName)}>
      <div className="w-sheet-shadow" aria-hidden />
      <div className={cn("w-sheet", className)}>{children}</div>
    </div>
  );
}

/** arrow keys of a radio group or tab list: move the selection, and the focus with it */
function arrowKeys(event: KeyboardEvent<HTMLElement>, index: number, count: number) {
  const step =
    event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
  const next =
    step !== 0
      ? (index + step + count) % count
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? count - 1
          : -1;
  if (next === -1) return;
  event.preventDefault();
  const items = event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[data-item]");
  items?.[next]?.focus();
  return next;
}

/* the controls of the panel, each 28px tall and as wide as its column */

function Segmented<V extends string | number | boolean>({
  label,
  choices,
  value,
  onChange,
}: {
  label: string;
  choices: Choice<V>[];
  value: V;
  onChange: (value: V) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid h-7 auto-cols-fr grid-flow-col gap-0.5 rounded-md border border-(--w-ink)/25 bg-(--w-paper)/70 p-0.5"
    >
      {choices.map((choice, i) => {
        const checked = choice.value === value;
        return (
          <button
            key={String(choice.value)}
            type="button"
            role="radio"
            data-item=""
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(choice.value)}
            onKeyDown={(event) => {
              const next = arrowKeys(event, i, choices.length);
              if (next !== undefined) onChange(choices[next]!.value);
            }}
            className={cn(
              "min-w-0 truncate rounded-[4px] px-1.5 text-xs hover:transition-colors",
              focusRing,
              checked ? inkFill : "text-(--w-muted) hover:text-(--w-ink)",
            )}
          >
            {choice.label}
          </button>
        );
      })}
    </div>
  );
}

function ThemeSwatches({
  value,
  onChange,
}: {
  value: ThemeId;
  onChange: (value: ThemeId) => void;
}) {
  const current = themes.find((theme) => theme.value === value);
  return (
    <div className="flex h-7 items-center justify-between gap-3">
      <div role="radiogroup" aria-label="Theme" className="flex items-center gap-2">
        {themes.map((theme, i) => {
          const checked = theme.value === value;
          return (
            <button
              key={theme.value}
              type="button"
              role="radio"
              data-item=""
              aria-checked={checked}
              aria-label={theme.label}
              title={theme.label}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(theme.value)}
              onKeyDown={(event) => {
                const next = arrowKeys(event, i, themes.length);
                if (next !== undefined) onChange(themes[next]!.value);
              }}
              style={{ "--sw-light": theme.light, "--sw-dark": theme.dark } as CSSProperties}
              className={cn(
                "size-4 rounded-full border border-(--w-ink)/30 bg-(--sw-light) [.dark_&]:bg-(--sw-dark)",
                focusRing,
                checked && "ring-1 ring-(--w-ink) ring-offset-2 ring-offset-(--w-sheet)",
              )}
            />
          );
        })}
      </div>
      <span className="min-w-0 truncate text-xs text-(--w-muted)">{current?.label}</span>
    </div>
  );
}

/** a plugin or part of the page, on or off: the lamp lights while it is on */
function FeatureSwitch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex h-7 min-w-0 items-center gap-2" title={hint}>
      <label htmlFor={id} className="min-w-0 flex-1 truncate text-[13px] text-(--w-ink)">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
          focusRing,
          // off: a pale empty track; on: a lit green track, as a lamp would be
          checked
            ? "border-(--w-green-deep) bg-(--w-green-deep)"
            : "border-(--w-ink)/25 bg-(--w-ink)/5",
        )}
      >
        <span
          className={cn(
            "absolute top-1/2 left-0.5 size-3.5 -translate-y-1/2 rounded-full border border-(--w-ink)/25 bg-(--w-sheet) shadow-[0_1px_1px_rgb(0_0_0/0.15)] transition-transform",
            checked && "translate-x-4 border-transparent",
          )}
        />
      </button>
    </div>
  );
}

const featureSwitches: { key: FeatureId | "actions"; label: string; hint: string }[] = [
  { key: "ai", label: "AI chat", hint: "aiPlugin of @fumapress/ai" },
  { key: "feedback", label: "Feedback", hint: "feedbackPlugin of @fumapress/feedback" },
  { key: "openapi", label: "OpenAPI", hint: "openapiPlugin of fumadocs-openapi" },
  { key: "blog", label: "Blog", hint: "blogPlugin of @fumapress/blog" },
  { key: "changelog", label: "Changelog", hint: "changelogPlugin of @fumapress/tegami" },
  { key: "actions", label: "Copy page", hint: "MarkdownCopyButton and ViewOptionsPopover" },
];

function NameInput({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <>
      <input
        id={id}
        value={value}
        list={`${id}-presets`}
        maxLength={24}
        spellCheck={false}
        autoComplete="off"
        placeholder={defaultConfig.name}
        onChange={(event) => onChange(event.target.value)}
        className="h-7 w-full min-w-0 rounded-md border border-(--w-ink)/25 bg-(--w-paper)/70 px-2.5 text-[13px] text-(--w-ink) outline-none transition-colors placeholder:text-(--w-muted) focus:border-(--w-ink)/70"
      />
      <datalist id={`${id}-presets`}>
        {namePresets.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="w-serif mb-2 flex items-center gap-3 text-[15px] text-(--w-ink-soft) italic">
        {title}
        <span className="h-px flex-1 bg-(--w-ink)/20" />
      </h4>
      <div className="flex flex-col gap-1.5">{children}</div>
    </section>
  );
}

/** a row of the panel: the label on the left, the control on the right */
function Row({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  const Label = htmlFor ? "label" : "span";
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3">
      <Label htmlFor={htmlFor} className="truncate text-[13px] text-(--w-ink)">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Panel({
  config,
  onChange,
  onReset,
}: {
  config: PlaygroundConfig;
  onChange: <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => void;
  onReset: () => void;
}) {
  const nameId = useId();
  const isDefault = (Object.keys(defaultConfig) as (keyof PlaygroundConfig)[]).every(
    (key) => config[key] === defaultConfig[key],
  );

  return (
    <Sheet wrapperClassName="h-full" className="h-full px-5 pt-4 pb-5">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="w-serif text-xl text-(--w-ink)">Settings</h3>
        <button
          type="button"
          onClick={onReset}
          disabled={isDefault}
          className={cn(
            "rounded-sm text-xs text-(--w-muted) transition-colors hover:text-(--w-ink) disabled:pointer-events-none disabled:opacity-40",
            focusRing,
          )}
        >
          Reset
        </button>
      </div>

      {/* two columns of sections while the panel sits below the preview */}
      <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-1">
        <Section title="Appearance">
          <Row label="Layout">
            <Segmented
              label="Layout"
              choices={layoutChoices}
              value={config.layout}
              onChange={(value) => onChange("layout", value)}
            />
          </Row>
          <Row label="Theme">
            <ThemeSwatches value={config.theme} onChange={(value) => onChange("theme", value)} />
          </Row>
        </Section>

        <Section title="Features">
          <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
            {featureSwitches.map((item) => (
              <FeatureSwitch
                key={item.key}
                label={item.label}
                hint={item.hint}
                checked={config[item.key]}
                onChange={(value) => onChange(item.key, value)}
              />
            ))}
          </div>
        </Section>

        <Section title="Details">
          <Row label="Site name" htmlFor={nameId}>
            <NameInput
              id={nameId}
              value={config.name}
              onChange={(value) => onChange("name", value)}
            />
          </Row>
          <Row label="Tabs">
            <Segmented
              label="Tabs"
              choices={tabsChoices}
              value={config.tabs}
              onChange={(value) => onChange("tabs", value)}
            />
          </Row>
          <Row label="Folders">
            <Segmented
              label="Folders"
              choices={folderChoices}
              value={config.openLevel}
              onChange={(value) => onChange("openLevel", value)}
            />
          </Row>
          <Row label="On this page">
            <Segmented
              label="On this page"
              choices={tocChoices}
              value={config.toc}
              onChange={(value) => onChange("toc", value)}
            />
          </Row>
        </Section>
      </div>
    </Sheet>
  );
}

/* the code of the config */

function CodeLines({
  code,
  previous,
  marking,
}: {
  code: string;
  previous: string;
  marking: boolean;
}) {
  const lines = useMemo(() => tokenize(code), [code]);
  const before = useMemo(() => new Set(previous.split("\n")), [previous]);
  const sources = code.split("\n");
  const box = useRef<HTMLDivElement>(null);

  // bring the first line a change wrote into view, inside the box and never the page
  useEffect(() => {
    const el = box.current;
    if (!el || !marking || previous === code) return;
    // the change that matters is in the config, past the imports it brings
    const changed = Array.from(el.querySelectorAll<HTMLElement>("[data-changed]"));
    const line =
      changed.find(
        (node) =>
          !/^\s*(import\b|\} from|from\b)/.test(node.textContent?.replace(/^\d+/, "") ?? ""),
      ) ?? changed[0];
    if (!line) return;
    const top = line.offsetTop;
    const bottom = top + line.offsetHeight;
    if (top >= el.scrollTop && bottom <= el.scrollTop + el.clientHeight) return;
    el.scrollTo({ top: Math.max(0, top - 44), behavior: "smooth" });
  }, [code, previous, marking]);

  return (
    <div
      ref={box}
      tabIndex={0}
      aria-label="Code"
      className={cn(
        "w-code w-scroll relative max-h-[24rem] overflow-auto xl:max-h-[30rem]",
        focusRing,
      )}
    >
      <pre className="overflow-visible! px-0! pt-4! pb-5!">
        <code className="inline-block min-w-full">
          {lines.map((line, i) => {
            const changed = marking && previous !== code && !before.has(sources[i]!);
            return (
              <span
                key={i}
                data-changed={changed ? "" : undefined}
                className={cn(
                  "flex transition-colors duration-700",
                  changed ? "bg-(--w-green)/15" : "bg-transparent",
                )}
              >
                <span
                  aria-hidden
                  className="relative w-11 shrink-0 pr-4 text-right text-(--w-code-comment)/70 select-none"
                >
                  <span
                    className={cn(
                      "absolute inset-y-0 left-0 w-[3px] bg-(--w-green) transition-opacity duration-700",
                      changed ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {i + 1}
                </span>
                <span className="pr-4">
                  {line.length === 0
                    ? " "
                    : line.map((token, j) => (
                        <span key={j} style={{ color: inkColors[token.kind] }}>
                          {token.text}
                        </span>
                      ))}
                </span>
              </span>
            );
          })}
        </code>
      </pre>
    </div>
  );
}

function CodeSheet({
  config,
  previous,
  marking,
}: {
  config: PlaygroundConfig;
  previous: PlaygroundConfig;
  marking: boolean;
}) {
  const [selected, setSelected] = useState("press.config.tsx");
  const id = useId();
  const files = codeFiles(config);
  const before = new Map(codeFiles(previous).map((file) => [file.name, file.code]));
  // the layout file leaves with the chat, its tab with it
  const active = Math.max(
    0,
    files.findIndex((file) => file.name === selected),
  );
  const file = files[active]!;

  return (
    <Sheet>
      <div
        role="tablist"
        aria-label="Files"
        className="flex gap-1 overflow-x-auto border-b border-(--w-ink)/20 px-3 [scrollbar-width:none]"
      >
        {files.map((item, i) => {
          const isActive = i === active;
          const changed = marking && before.get(item.name) !== item.code;
          return (
            <button
              key={item.name}
              type="button"
              role="tab"
              data-item=""
              id={`${id}-tab-${i}`}
              aria-selected={isActive}
              aria-controls={`${id}-panel`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSelected(item.name)}
              onKeyDown={(event) => {
                const next = arrowKeys(event, i, files.length);
                if (next !== undefined) setSelected(files[next]!.name);
              }}
              className={cn(
                // the underline is drawn inside the tab, so the scrolling row never overflows downward
                "relative flex shrink-0 items-center gap-2 px-3 py-2.5 font-mono text-[12.5px] after:absolute after:inset-x-0 after:bottom-0 after:h-[1.5px] hover:transition-colors",
                focusRing,
                isActive
                  ? "text-(--w-ink) after:bg-(--w-ink)"
                  : "text-(--w-muted) hover:text-(--w-ink)",
              )}
            >
              {item.name}
              {/* a file the last change wrote, while it isn't shown */}
              <span
                aria-hidden
                className={cn(
                  "size-1.5 rounded-full bg-(--w-green-deep) transition-opacity duration-700",
                  changed && !isActive ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${active}`}>
        <CodeLines code={file.code} previous={before.get(file.name) ?? ""} marking={marking} />
      </div>
    </Sheet>
  );
}

/* the preview */

function send(frame: RefObject<HTMLIFrameElement | null>, config: PlaygroundConfig) {
  frame.current?.contentWindow?.postMessage(
    { type: messageType, kind: "config", config } satisfies PlaygroundMessage,
    location.origin,
  );
}

/** the real Fumadocs UI in an iframe, rendered at a desktop viewport and scaled to the width of the frame */
function Preview({ config, device }: { config: PlaygroundConfig; device: ReactNode }): ReactNode {
  const frame = useRef<HTMLIFrameElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>();
  /** the iframe mounts once the frame comes near the viewport, and stays */
  const [near, setNear] = useState(false);
  const latest = useRef(config);
  latest.current = config;

  useIsomorphicLayoutEffect(() => {
    const element = screen.current;
    if (!element) return;
    const resize = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / viewport.width);
    });
    const intersect = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setNear(true);
        intersect.disconnect();
      },
      { rootMargin: "600px 0px" },
    );
    resize.observe(element);
    intersect.observe(element);
    return () => {
      resize.disconnect();
      intersect.disconnect();
    };
  }, []);

  // the preview asks for the config once it listens, then follows every change
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow) return;
      if (isPlaygroundMessage(event.data) && event.data.kind === "ready")
        send(frame, latest.current);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // a click shows at once, typing a name renders the preview when the typing pauses
  const sent = useRef(config);
  useEffect(() => {
    const typing = sent.current.name !== config.name;
    const timer = setTimeout(
      () => {
        sent.current = config;
        send(frame, config);
      },
      typing ? 150 : 0,
    );
    return () => clearTimeout(timer);
  }, [config]);

  const host = `${
    siteName(config)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "acme"
  }.dev`;

  return (
    <div className="relative">
      {device}
      {/* the address on the plate of the device */}
      <span
        className="absolute flex items-center justify-center truncate px-[3%] font-mono text-[clamp(8px,1.5vw,11px)] text-(--w-muted)"
        style={percentOf({ x: 200, y: 15, w: 240, h: 24 })}
        aria-hidden
      >
        {host}/docs
      </span>
      {/* the glass: the real docs UI, scaled to fit */}
      <div
        ref={screen}
        className="absolute overflow-hidden rounded-[2px] bg-(--w-paper)"
        style={percentOf(glass)}
      >
        {near && (
          <iframe
            ref={frame}
            src={previewPath}
            title="Preview of the docs site"
            loading="lazy"
            className={cn(
              "absolute top-0 left-0 origin-top-left border-0 transition-opacity duration-300",
              scale === undefined && "opacity-0",
            )}
            style={{
              width: viewport.width,
              height: viewport.height,
              transform: `scale(${scale ?? 0.5})`,
            }}
          />
        )}
      </div>
    </div>
  );
}

/** the docs UI as a canvas with its settings beside it, and the config they write below */
export function Playground({ device }: { device: ReactNode }) {
  const [state, setState] = useState({ config: defaultConfig, previous: defaultConfig });
  const [marking, setMarking] = useState(false);
  const { config, previous } = state;

  function update<K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) {
    setMarking(true);
    setState((state) => ({
      config: { ...state.config, [key]: value },
      // while typing a name, its line stays marked
      previous: key === "name" ? { ...state.config, name: state.previous.name } : state.config,
    }));
  }

  function reset() {
    setMarking(true);
    setState((state) => ({ config: defaultConfig, previous: state.config }));
  }

  // the marks of a change fade once, every change restarts the wait
  useEffect(() => {
    if (!marking) return;
    const timer = setTimeout(() => setMarking(false), markDuration);
    return () => clearTimeout(timer);
  }, [marking, state]);

  return (
    <div className="flex flex-col gap-y-14 xl:gap-y-16">
      {/* the panel beside the canvas from 1280px, its controls need about 320px */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-12 xl:grid-cols-[minmax(0,17fr)_minmax(0,8fr)] xl:items-stretch">
        <div className="relative self-start">
          {/* the cord plugs into the top of the device and leaves from its foot */}
          <Jack edge="top" x={94} y={1.8} />
          <Preview config={config} device={device} />
          <Jack edge="bottom" x={50} y={96} wander={[0.55, 0.6]} />
        </div>
        <Panel config={config} onChange={update} onReset={reset} />
      </div>
      <div className="relative">
        <CodeSheet config={config} previous={previous} marking={marking} />
      </div>
    </div>
  );
}
