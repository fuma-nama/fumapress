export function joinPathname(...paths: string[]): string {
  let combined = paths.join("/").replaceAll(/\/+/g, "/");
  if (!combined.startsWith("/")) combined = "/" + combined;
  if (combined.endsWith("/")) combined = combined.slice(0, -1);
  return combined;
}

const PATHNAME_SEGMENT_REGEX = /^[A-Za-z0-9\-._~!$&'()*+,;=:@]+$/;

/** Check if the string is a full pathname (one that does not include `.` or `..`) */
export function isPlainPathname(s: string) {
  return (
    s.startsWith("/") &&
    s
      .slice(1)
      .split("/")
      .every((seg) => seg !== "." && seg !== ".." && PATHNAME_SEGMENT_REGEX.test(seg))
  );
}
