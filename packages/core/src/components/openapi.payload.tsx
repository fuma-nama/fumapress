"use client";

import { ClientApiPagePayload, ClientApiPageProps } from "fumadocs-openapi/ui/create-client";
import { createContext, type FC, ReactNode, use, useMemo } from "react";

export type PayloadObject = Record<string, ClientApiPagePayload>;

const Context = createContext<PayloadObject | null>(null);

export function PayloadProvider({ payload, children }: { payload: string; children: ReactNode }) {
  const decoded = useMemo(() => JSON.parse(payload) as PayloadObject, [payload]);

  return <Context value={decoded}>{children}</Context>;
}

export function WithPayload({
  schemaId,
  Comp,
  props,
}: {
  schemaId: string;
  Comp: FC<ClientApiPageProps>;
  props: Omit<ClientApiPageProps, "payload">;
}) {
  const payload = use(Context)?.[schemaId];
  if (!payload)
    throw new Error(
      `[Fumapress] Failed to find OpenAPI payload for schema "${schemaId}", do you sure it is defined in createOpenAPI()?`,
    );

  return <Comp payload={payload} {...props} />;
}
