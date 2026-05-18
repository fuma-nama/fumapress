import type { ConfigContext } from "@/config";
import type { ServerPlugin } from "@/lib/types";

export function disableSearchPlugin<C extends ConfigContext>(): ServerPlugin<C> {
  return {
    name: "core:disable-search-if-needed",
    enforce: "post",
    init() {
      const hooks = (this.data["core:provider"] ??= []);
      hooks.push((data) => {
        // search-feature plugins must set the `search` prop, otherwise will disable search by default.
        data.search ??= { enabled: false };
        return data;
      });
    },
  };
}
