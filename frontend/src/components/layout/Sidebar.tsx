"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogIn, UserPlus } from "lucide-react";
import { sidebarNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";
import { useAuth } from "@/features/auth/AuthContext";
import { cn } from "@/lib/cn";
import { formatBaht } from "@/lib/format";

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated, user, openAuthModal } = useAuth();

  return (
    <>
      {/* Fixed 68px spacer so main content never shifts when sidebar expands on hover */}
      <div className="w-[68px] shrink-0 h-screen hidden sm:block" aria-hidden="true" />

      <aside
        aria-label="เมนูหลัก"
        className="group/sidebar fixed top-0 left-0 h-screen w-[68px] hover:w-64 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] bg-obsidian-950 border-r border-zinc-800/80 z-50 hidden sm:flex flex-col justify-between overflow-hidden"
      >
        {/* Top Brand Header */}
        <div>
          <div className="h-16 flex items-center px-3.5 border-b border-zinc-800/80 overflow-hidden">
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <img
                src={siteConfig.logo}
                alt={`${siteConfig.name} Logo`}
                className="w-10 h-10 rounded-lg object-cover bg-zinc-950 border border-zinc-700/80 shrink-0"
              />
              <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 delay-75 whitespace-nowrap">
                <span className="text-sm font-bold tracking-tight text-white font-display block">
                  {siteConfig.name}
                </span>
                <span className="text-[9px] font-mono font-semibold tracking-widest text-zinc-400 uppercase block -mt-0.5">
                  {siteConfig.tagline}
                </span>
              </div>
            </Link>
          </div>

          {/* Primary Navigation */}
          <nav className="px-2.5 py-4 space-y-1 overflow-y-auto no-scrollbar max-h-[calc(100vh-180px)]">
            <p className="px-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-zinc-500 mb-2 opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
              NAVIGATION // 01
            </p>

            {sidebarNav.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3.5 px-3 py-2.5 rounded-lg text-xs transition-colors shrink-0",
                    isActive
                      ? "font-semibold text-white bg-zinc-900 border border-zinc-700/80"
                      : "font-medium text-zinc-400 hover:text-white hover:bg-zinc-900/60",
                  )}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    <Icon
                      className={cn(
                        "w-4 h-4",
                        isActive ? "text-white" : "text-current",
                      )}
                    />
                  </div>
                  <span className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 whitespace-nowrap">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Area */}
        <div className="p-2.5 border-t border-zinc-800/80 bg-obsidian-900 overflow-hidden">
          {isAuthenticated ? (
            <div className="space-y-1.5">
              <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 px-1 flex items-center gap-1.5 text-[10px] text-emerald-400 font-mono whitespace-nowrap">
                <span className="w-1.5 h-1.5 bg-emerald-400" />
                <span>24/7 AUTO-DELIVERY ONLINE</span>
              </div>

              <div className="p-2 rounded-lg bg-zinc-950 border border-zinc-800 flex items-center gap-3 overflow-hidden">
                <div className="w-8 h-8 rounded-md bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white text-xs font-mono font-bold shrink-0">
                  {user?.username ? user.username.charAt(0).toUpperCase() : "U"}
                </div>
                <div className="opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200 min-w-0 flex-1 whitespace-nowrap">
                  <div className="flex items-center justify-between">
                    <Link
                      href="/member/profile"
                      className="text-xs font-semibold text-white hover:text-zinc-300 transition-colors leading-tight truncate block"
                    >
                      {user?.username || "บัญชีผู้ใช้"}
                    </Link>
                    <span className="w-1.5 h-1.5 bg-emerald-400" />
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-mono font-bold text-white num-tabular">
                      {formatBaht(user?.balance || 0)}
                    </p>
                    <Link
                      href="/topup"
                      className="px-2 py-0.5 rounded-sm text-[10px] font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors"
                    >
                      + เติม
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              {/* Collapsed 68px Icon button */}
              <button
                type="button"
                onClick={() => openAuthModal("login")}
                title="เข้าสู่ระบบ หรือ สมัครสมาชิก"
                className="w-10 h-10 mx-auto rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 flex group-hover/sidebar:hidden items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-white" />
              </button>

              {/* Expanded 256px Auth Card */}
              <div className="hidden group-hover/sidebar:block p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-300">
                    เข้าสู่ระบบบัญชี
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    KZ // AUTH
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className="py-1.5 px-2 rounded-md text-xs font-medium text-zinc-300 hover:text-white bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <LogIn className="w-3 h-3 text-zinc-400" />
                    <span>เข้าสู่ระบบ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal("register")}
                    className="py-1.5 px-2 rounded-md text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3 h-3 text-zinc-950" />
                    <span>สมัคร</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
