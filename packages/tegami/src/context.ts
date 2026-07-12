import type { AppContext, AppShape } from "fumapress";
import { AsyncLocalStorage } from "node:async_hooks";

export interface ChangelogContext<C extends AppShape = AppShape> {
  indexPath: string | false;
  isChangelog: (this: AppContext<C>, page: C["page"]) => boolean;
}

export const changelogContext = new AsyncLocalStorage({
  name: "fumapress:changelog",
});

export function getChangelogContext<C extends AppShape = AppShape>(): ChangelogContext<C> {
  const store = changelogContext.getStore();
  if (!store) {
    throw new Error(
      "[@fumapress/tegami] Missing changelog context, make sure changelogPlugin() is configured",
    );
  }
  return store as ChangelogContext<C>;
}
