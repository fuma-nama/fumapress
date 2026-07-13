import type { AppContext, AppShape } from "@/app/context";
import type { ReactNode } from "react";

export type Interceptor<S extends AppShape, T, Env extends object = object> = (
  this: AppContext<S>,
  opts: Env & {
    props: T;
    next: (props: T) => ReactNode;
  },
) => ReactNode;

export function renderWithInterceptors<S extends AppShape, T, Env extends object>(
  ctx: AppContext<S>,
  env: Env,
  fn: (props: T) => ReactNode,
  interceptors?: (Interceptor<S, T, Env> | undefined)[],
): (props: T) => ReactNode {
  function run(i: number, props: T): ReactNode {
    if (interceptors && i < interceptors.length) {
      const interceptor = interceptors[i];
      if (!interceptor) return run(i + 1, props);
      return interceptor.call(ctx, { ...env, props, next: (v) => run(i + 1, v) });
    }
    return fn(props);
  }

  return (props) => run(0, props);
}
