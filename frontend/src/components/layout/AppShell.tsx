"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/features/auth/AuthContext";
import { AuthModal } from "@/features/auth/components/AuthModal";
import { BackToTop } from "./BackToTop";
import { Footer } from "./Footer";
import { Sidebar } from "./Sidebar";
import { TopHeader } from "./TopHeader";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen bg-obsidian-950 text-slate-100">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopHeader />
          <main className="flex-1 px-6 pb-6 max-w-[1440px] w-full mx-auto">
            {children}
            <Footer />
          </main>
        </div>
        <BackToTop />
        <AuthModal />
      </div>
    </AuthProvider>
  );
}
