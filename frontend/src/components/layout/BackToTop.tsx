"use client";

import { ArrowUp } from "lucide-react";
import { useScrolledPast } from "@/hooks/useScrollSpy";
import { cn } from "@/lib/cn";

export function BackToTop() {
  const visible = useScrolledPast(250);

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="กลับขึ้นด้านบน"
      title="กลับขึ้นด้านบน"
      className={cn(
        "fixed bottom-6 right-6 z-40 w-10 h-10 rounded-full bg-obsidian-850 border border-white/10 text-slate-300 hover:text-white hover:bg-white/[0.08] transition-all flex items-center justify-center group shadow-lg cursor-pointer",
        visible ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
      )}
    >
      <ArrowUp className="w-4 h-4 group-hover:-translate-y-0.5 transition-transform" />
    </button>
  );
}
