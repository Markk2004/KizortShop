import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
