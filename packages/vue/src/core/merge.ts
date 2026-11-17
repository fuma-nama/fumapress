function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** objects merge deeply and lists concatenate, in order; otherwise the first defined value wins */
export function mergeOptions<T extends object>(
  sources: readonly (Partial<T> | undefined)[],
): Partial<T>;
export function mergeOptions(sources: readonly unknown[]): Record<string, unknown> {
  // without a prototype: a key like `constructor` is a key like any other
  const out: Record<string, unknown> = Object.create(null);
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const [key, value] of Object.entries(source)) {
      if (value === undefined) continue;
      const current = out[key];
      if (current === undefined) out[key] = value;
      else if (Array.isArray(current) && Array.isArray(value)) out[key] = [...current, ...value];
      else if (isPlainObject(current) && isPlainObject(value))
        out[key] = mergeOptions([current, value]);
    }
  }
  return { ...out };
}
