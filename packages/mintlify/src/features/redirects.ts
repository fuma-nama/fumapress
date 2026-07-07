import type { MintlifyRedirect } from "../schema";

/**
 * Mintlify redirects support Next.js-style path patterns:
 *
 * - `/old/:slug` matches a single segment, available as `:slug` in `destination`
 * - `/old/:slug*` matches zero or more segments
 */

interface CompiledRedirect {
  redirect: MintlifyRedirect;
  match: (pathname: string) => string | undefined;
}

function splitPath(pathname: string): string[] {
  return pathname.split("/").filter((segment) => segment.length > 0);
}

export function compileRedirect(redirect: MintlifyRedirect): CompiledRedirect {
  const sourceSegments = splitPath(redirect.source);

  function substitute(params: Map<string, string[]>): string {
    const result = redirect.destination.replace(
      /:(\w+)\*?/g,
      (_, name: string) => params.get(name)?.join("/") ?? "",
    );

    // an empty catch-all parameter may leave a trailing slash behind
    return result.length > 1 && result.endsWith("/") ? result.slice(0, -1) : result;
  }

  return {
    redirect,
    match(pathname) {
      const segments = splitPath(pathname);
      const params = new Map<string, string[]>();

      for (let i = 0; i < sourceSegments.length; i++) {
        const source = sourceSegments[i]!;
        const match = /^:(\w+)(\*)?$/.exec(source);

        if (match?.[2]) {
          // catch-all: consume the rest (zero or more segments)
          if (i !== sourceSegments.length - 1) {
            console.warn(
              `[Fumapress Mintlify] Redirect source "${redirect.source}" has a catch-all parameter before the last segment, it is only supported at the end.`,
            );
            return;
          }

          params.set(match[1]!, segments.slice(i));
          return substitute(params);
        }

        const segment = segments[i];
        if (segment === undefined) return;

        if (match) {
          params.set(match[1]!, [segment]);
        } else if (segment !== source) {
          return;
        }
      }

      if (segments.length !== sourceSegments.length) return;
      return substitute(params);
    },
  };
}

export function createRedirectMatcher(redirects: MintlifyRedirect[]) {
  const compiled = redirects.map(compileRedirect);

  return (pathname: string): { destination: string; permanent: boolean } | undefined => {
    const normalized =
      pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

    for (const { redirect, match } of compiled) {
      const destination = match(normalized);
      if (destination === undefined) continue;

      return {
        destination,
        permanent: redirect.permanent !== false,
      };
    }
  };
}
