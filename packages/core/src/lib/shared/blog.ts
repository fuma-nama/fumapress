import type { AppContext } from "../shared";
import type { ConfigContext } from "@/config";

export async function getTags<C extends ConfigContext>(
  ctx: AppContext<C>,
  page: C["loaderConfig"]["page"],
) {
  for (const adapter of ctx.adapters) {
    const tags = await adapter["blog:get-tags"]?.call(ctx, page);
    if (tags !== undefined) return tags;
  }
}
