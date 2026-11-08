import type { ReactNode } from "react";
import { getPressContext, type WakuRouteProps } from "fumapress";
import type { app } from "../../press.config";
import { HomeShell } from "../ui/layout";

export default async function Layout({
  lang,
  children,
}: WakuRouteProps<typeof app> & { children: ReactNode }) {
  const layoutProps = await getPressContext<typeof app>().getLayoutProps({ lang });
  return <HomeShell layoutProps={layoutProps}>{children}</HomeShell>;
}
