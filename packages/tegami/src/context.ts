import type { ConfigContext } from "fumapress";
import type { AppContext } from "fumapress";
import { AsyncLocalStorage } from "node:async_hooks";

export interface ChangelogContext<C extends ConfigContext = ConfigContext> {
  indexPath: string | false;
  isChangelog: (this: AppContext<C>, page: C["page"]) => boolean;
}

export const changelogContext = new AsyncLocalStorage({
  name: "fumapress:changelog",
});

export function getChangelogContext<
  C extends ConfigContext = ConfigContext,
>(): ChangelogContext<C> {
  const store = changelogContext.getStore();
  if (!store) {
    throw new Error(
      "[@fumapress/tegami] Missing changelog context, make sure changelogPlugin() is configured",
    );
  }
  return store as ChangelogContext<C>;
}
