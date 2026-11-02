import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/flexsearch";

export interface FlexsearchOptions<C extends AppShape = AppShape> extends Press.FlexsearchOptions<
  C,
  AppContext<C>
> {}

export function flexsearchPlugin<C extends AppShape = AppShape>(
  options?: FlexsearchOptions<NoInfer<C>>,
): PressPlugin<C> {
  return {
    ...Press.flexsearchPlugin<C, AppContext<C>>(options),
    init() {
      if (this.mode !== "static") return;
      ((this.data["core:provider"] ??= {}).transformers ??= []).push(async (props) => {
        (props.search ??= { enabled: true }).SearchDialog ??= (
          await import("@/components/flexsearch-static")
        ).default;
        return props;
      });
    },
  };
}
