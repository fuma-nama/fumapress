import type { InjectionKey, Ref } from "vue";
import type { Highlighter } from "@fumapress/vue/highlight";
import type { CodeBlockProps } from "../codeblock";

/** the `codeblock` prop for the default `pre` */
export const PropsKey: InjectionKey<Readonly<Ref<CodeBlockProps | undefined>>> = Symbol(
  "fd-dynamic-codeblock-props",
);

const languages = new WeakMap<Highlighter, Map<string, Promise<void>>>();
/** the promises of `languages` that resolved: React's `use()` reads it from the promise */
const loaded = new WeakSet<Promise<void>>();

/** load a language once per highlighter, `true` once it is loaded */
export function loadLanguage(
  highlighter: Highlighter & Required<Pick<Highlighter, "loadLanguage">>,
  lang: string,
): Promise<void> | true {
  let loading = languages.get(highlighter);
  if (!loading) languages.set(highlighter, (loading = new Map()));
  let promise = loading.get(lang);
  if (!promise) {
    const created = highlighter.loadLanguage(lang);
    loading.set(lang, (promise = created));
    created.then(
      () => loaded.add(created),
      () => {},
    );
  }

  return loaded.has(promise) || promise;
}
