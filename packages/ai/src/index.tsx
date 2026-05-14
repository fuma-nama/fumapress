import { type AIRouteOptions, createRouteHandler } from "./api";
import type { ConfigContext, ServerPlugin } from "fumapress";
import type { DocsLayoutContextData } from "fumapress/layouts/docs";

export interface AIOptions<C extends ConfigContext = ConfigContext> extends AIRouteOptions<C> {
  /** @default true */
  configureUI?: boolean;
}

export function aiPlugin<C extends ConfigContext = ConfigContext>(
  options: AIOptions<NoInfer<C>>,
): ServerPlugin<C> {
  const { configureUI = true } = options;

  function initRenderers(ctxData: DocsLayoutContextData) {
    const renderers = (ctxData.renderers ??= []);

    renderers.push(async (data) => {
      const { DefaultComponent } = await import("./components/default");
      const transformers = (data.layoutProps.children ??= []);
      transformers.push((children) => (
        <>
          {children}
          <DefaultComponent />
        </>
      ));
      return data;
    });
  }

  return {
    init() {
      if (configureUI) {
        initRenderers((this.data["core:docs-layout"] ??= {}));
        initRenderers((this.data["core:notebook-layout"] ??= {}) as never);
      }
    },
    createPages({ createApi }) {
      const { onRequest } = createRouteHandler(options, this);

      if (this.mode === "static") {
        throw new Error(
          "[Fumapress] the @fumapress/ai plugin is not compatible with mode: 'static'",
        );
      }

      createApi({
        path: "/api/ai",
        render: "dynamic",
        handlers: {
          POST: onRequest,
        },
      });
    },
  };
}

export type { SearchTool, AIRouteOptions, ChatUIMessage } from "./api";
