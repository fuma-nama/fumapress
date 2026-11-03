"use client";
import { useState, type ReactNode } from "react";

export function Counter({ initial = 0 }: { initial?: number; onClick?: () => void }) {
  const [count, setCount] = useState(initial);
  return (
    <button type="button" onClick={() => setCount(count + 1)}>
      count {count}
    </button>
  );
}

export function Star() {
  return <span>star</span>;
}

export function Frame({ children }: { children?: ReactNode }) {
  return <section data-frame="">{children}</section>;
}
