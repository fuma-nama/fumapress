import type { AppContext, AppShape } from "@/app/context";
import type { PressPlugin } from "@/app/plugin";
import * as Press from "@fumapress/core/plugins/link-validation";

export type {
  Diagnostic,
  DiagnosticsFile,
  LinkValidationOptions,
} from "@fumapress/core/plugins/link-validation";

export function linkValidationPlugin<C extends AppShape = AppShape>(
  options?: Press.LinkValidationOptions,
): PressPlugin<C> {
  return Press.linkValidationPlugin<C, AppContext<C>>(options);
}
