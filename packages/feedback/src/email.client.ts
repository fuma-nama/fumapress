"use client";

import type { ActionResponse, BlockFeedback, PageFeedback } from "@/schema";

export async function onPageFeedbackAction(feedback: PageFeedback): Promise<ActionResponse> {
  const result = await fetch("/api/feedback/page", {
    method: "POST",
    body: JSON.stringify(feedback),
  });

  if (!result.ok) throw new Error(await result.text());
  return result.json();
}

export async function onTextFeedbackAction(feedback: BlockFeedback): Promise<ActionResponse> {
  const result = await fetch("/api/feedback/text", {
    method: "POST",
    body: JSON.stringify(feedback),
  });

  if (!result.ok) throw new Error(await result.text());
  return result.json();
}
