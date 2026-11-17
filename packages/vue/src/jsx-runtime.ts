import { Fragment, h, type VNode } from "vue";

type Props = Record<string, unknown> & { children?: unknown };

/**
 * The JSX runtime of compiled Markdown. Unlike `vue/jsx-runtime`, the children of a component are its default slot, as
 * a function: Vue renders them lazily and without a warning. The React names of the Markdown pipeline (`className`,
 * `dangerouslySetInnerHTML`) are mapped to Vue's.
 */
export function jsx(type: unknown, props: Props | null, key?: unknown): VNode {
  const { children, className, dangerouslySetInnerHTML, ...rest } = props ?? {};
  if (className !== undefined) rest.class = rest.class ? [rest.class, className] : className;
  if (dangerouslySetInnerHTML) {
    rest.innerHTML = (dangerouslySetInnerHTML as { __html: string }).__html;
  }
  if (key !== undefined) rest.key = key;

  const component = type as Parameters<typeof h>[0];
  if (children === undefined || children === null) return h(component, rest);
  if (typeof type === "string" || type === Fragment) {
    return h(component, rest, Array.isArray(children) ? children : [children]);
  }
  return h(component, rest, { default: () => children });
}

export { jsx as jsxs, jsx as jsxDEV, Fragment };
