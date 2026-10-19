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
        className="glass-island pointer-events-auto p-1 rounded-md flex items-center gap-1 overflow-x-auto max-w-full no-scrollbar transition-all duration-200"
      >
        {homeAnchors.map((item) => {
          const isActive = activeId === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleJump(item.id)}
              className={cn(
                "px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer",
                isActive
                  ? "text-zinc-950 bg-white font-semibold"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900",
              )}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
