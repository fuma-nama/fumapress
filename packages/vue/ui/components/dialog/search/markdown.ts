import { h, type FunctionalComponent } from "vue";
import type { ToJsxOptions } from "../../../core/utils/hast-to-jsx";
import { cn } from "../../../utils/cn";

type Props = Record<string, unknown>;

/** a component of hast elements: its props replace attributes, which don't fall through */
function component(render: FunctionalComponent<Props>): FunctionalComponent<Props> {
  render.inheritAttrs = false;
  return render;
}

const mdComponents = {
  // from the deprecated `highlightMarkdown()` of custom search clients
  mark: component((props, { slots }) =>
    h("span", { ...props, class: "text-fd-primary underline" }, slots.default?.()),
  ),
  a: "span" as const,
  p: component((props, { slots }) => h("p", { ...props, class: "min-w-0" }, slots.default?.())),
  custom: component(({ tagName, ...rest }, { slots }) => {
    return h(
      "span",
      {
        class:
          "inline-flex max-w-full items-center border p-0.5 rounded-md bg-fd-card text-fd-card-foreground divide-x divide-fd-border",
      },
      [
        h(
          "code",
          {
            "data-highlight-ignore": "",
            class:
              "not-prose rounded-sm px-0.5 me-1 bg-fd-primary font-medium text-xs text-fd-primary-foreground border-none",
          },
          String(tagName),
        ),
        Object.entries(rest).map(([k, v]) => {
          if (typeof v !== "string") return;

          return h(
            "code",
            {
              key: k,
              "data-highlight-ignore": "",
              class: "not-prose truncate text-xs text-fd-muted-foreground px-1",
            },
            [h("span", { class: "text-fd-card-foreground" }, `${k}: `), v],
          );
        }),
        slots.default && h("span", { class: "ps-1" }, slots.default()),
      ],
    );
  }),
  pre: component((props, { slots }) =>
    h(
      "pre",
      {
        ...props,
        class: cn(
          "not-prose flex flex-col border rounded-md my-0.5 p-2 bg-fd-secondary text-fd-secondary-foreground max-h-20 overflow-hidden *:mask-[linear-gradient(to_bottom,white,white_30px,transparent_80px)]",
          props.class as string | undefined,
        ),
      },
      slots.default?.(),
    ),
  ),
};

export const renderOptions: ToJsxOptions = { components: mdComponents };

const Children = component((_, { slots }) => slots.default?.());

const TableCell = component((props, { slots }) =>
  h("div", { ...props, class: "min-w-0 not-last:truncate last:line-clamp-2" }, slots.default?.()),
);

// tables of cards render their cells only, the grid of `<SearchDialogListTable />` lays them out
export const tableRenderOptions: ToJsxOptions = {
  components: {
    ...mdComponents,
    table: Children,
    thead: Children,
    tbody: Children,
    tr: Children,
    th: TableCell,
    td: TableCell,
  },
};

// rows of tables with header, `<SearchDialogListTable />` shows the header once
export const rowRenderOptions: ToJsxOptions = {
  components: { ...tableRenderOptions.components, thead: component(() => null) },
};
