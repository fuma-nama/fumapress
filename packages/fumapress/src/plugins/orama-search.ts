import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/orama-search";

export interface OramaSearchOptions<C extends AppShape = AppShape> extends Press.OramaSearchOptions<
  C,
  AppContext<C>
> {}

export function oramaSearchPlugin<C extends AppShape = AppShape>(
  options?: OramaSearchOptions<NoInfer<C>>,
): PressPlugin<C> {
  return Press.oramaSearchPlugin<C, AppContext<C>>(options);
}
