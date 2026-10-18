"use client";

import { homeAnchors } from "@/config/navigation";
import { useScrollSpy } from "@/hooks/useScrollSpy";
import { cn } from "@/lib/cn";

const sectionIds = homeAnchors.map((a) => a.id);

export function AnchorIsland() {
  const [activeId, setActiveId] = useScrollSpy(sectionIds);

  const handleJump = (id: string) => {
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="sticky top-[74px] z-30 flex justify-center px-4 pointer-events-none -mb-10">
      <nav
        aria-label="ทางลัดส่วนหน้าเว็บ"
        className="glass-island pointer-events-auto px-1.5 py-1 rounded-full flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar transition-all duration-300"
      >
        {homeAnchors.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleJump(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer",
                isActive
                  ? "text-white bg-white/[0.12] border border-white/15"
                  : "text-slate-400 hover:text-white hover:bg-white/[0.04]",
              )}
            >
              {isActive && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
