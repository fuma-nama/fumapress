import type { ConfigContext } from "@/config";
import { fumapressTranslations } from "@/i18n";
import type { ServerPlugin } from "@/lib/types";

export function applyDefaultsPlugin<C extends ConfigContext>(): ServerPlugin<C>[] {
  return [
    {
      name: "core:i18n",
      init() {
        if (this.translationsConfig) {
          this.translationsConfig.extend(fumapressTranslations());
        }
      },
    },
    {
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
    },
  ];
}
