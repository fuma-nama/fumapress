import type { BuildOutput } from "fumadocs-core/framework/plugin";

/**
 * The build output of plugins, from the `emitFile` util of the server entry build: paths are relative
 * to the build output directory (e.g. `dist/`), so files sit next to `public/` and `server/` rather
 * than being publicly served.
 */
export function toBuildOutput(
  emitFile: (path: string, body: ReadableStream) => Promise<void>,
): BuildOutput {
  return {
    emitFile: (path, content) =>
      // a copy of bytes, the body of responses can't be a view of shared memory
      emitFile(path, new Response(typeof content === "string" ? content : content.slice()).body!),
  };
}
