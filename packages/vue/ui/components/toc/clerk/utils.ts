const BASE = 8;

export function getItemOffset(depth: number): number {
  if (depth <= 2) return 12 + BASE;
  if (depth === 3) return 24 + BASE;
  return 36 + BASE;
}

export function getLineOffset(depth: number): number {
  if (depth <= 2) return BASE;
  if (depth === 3) return 12 + BASE;
  return 24 + BASE;
}
