import type { AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/robots";

export type { RobotsOptions, RobotsRule } from "@fumapress/core/plugins/robots";

export function robotsPlugin<C extends AppShape = AppShape>(
  options?: Press.RobotsOptions,
): PressPlugin<C> {
  return Press.robotsPlugin<C>(options);
}
