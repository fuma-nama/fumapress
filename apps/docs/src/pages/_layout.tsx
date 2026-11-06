import type { ReactNode } from "react";
import { getPressContext, type WakuRouteProps } from "fumapress";
import type { app } from "../../press.config";
import { HomeShell } from "../ui/layout";

export default async function Layout({
  lang,
  children,
}: WakuRouteProps<typeof app> & { children: ReactNode }) {
  const baseOptions = await getPressContext<typeof app>().getBaseOptions({ lang });
  return <HomeShell baseOptions={baseOptions}>{children}</HomeShell>;
}
