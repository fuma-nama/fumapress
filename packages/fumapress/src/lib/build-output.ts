/**
 * Helpers for plugins that emit extra files into the build output via the
 * `emitFile` util of `unstable_onServerEntry`. Paths passed to `emitFile` are
 * relative to the build output directory (e.g. `dist/`), so files written here
 * sit next to `public/` and `server/` rather than being publicly served.
 */

export function bytesToStream(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

export function stringToStream(value: string): ReadableStream<Uint8Array> {
  return bytesToStream(new TextEncoder().encode(value));
}

export function jsonToStream(value: unknown): ReadableStream<Uint8Array> {
  return stringToStream(JSON.stringify(value, null, 2));
}
