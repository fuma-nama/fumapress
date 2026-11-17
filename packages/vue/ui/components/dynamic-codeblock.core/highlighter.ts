import type { Highlighter } from "@fumapress/vue/highlight";

/**
 * The highlighter of a `highlighter` prop, like `createShikiHighlighter()` of the source: a function is called by
 * `loadLanguage()`, which resolves the instance.
 */
export function createHighlighter(
  highlighter: Highlighter | (() => Highlighter | PromiseLike<Highlighter>),
): Highlighter {
  if (typeof highlighter !== "function") return highlighter;
  const factory = highlighter;
  let instance: Highlighter | undefined;

  function getInstance() {
    // a factory resolves the instance in `loadLanguage()`
    if (!instance) throw new Error("[Fumadocs] load the language before highlighting");
    return instance;
  }

  const loading = new Map<string, Promise<void>>();
  async function load(lang: string) {
    const resolved = await factory();
    await resolved.loadLanguage?.(lang);
    instance = resolved;
  }

  return {
    async loadLanguage(...langs) {
      const tasks: Promise<void>[] = [];
      for (const lang of langs) {
        let task = loading.get(lang);
        if (!task) {
          loading.set(lang, (task = load(lang)));
          task.catch(() => loading.delete(lang));
        }
        tasks.push(task);
      }
      await Promise.all(tasks);
    },
    codeToHast(code, codeOptions) {
      return getInstance().codeToHast(code, codeOptions);
    },
  };
}
