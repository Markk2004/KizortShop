import { ArrowUpRight, Bell } from "lucide-react";
import { siteConfig } from "@/config/site";

export function AnnouncementBar() {
  return (
    <section
      id="section-vip"
      className="relative rounded-lg overflow-hidden p-6 sm:p-7 bg-obsidian-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-zinc-800"
    >
      {/* Background Roblox Artwork with Dark Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20 mix-blend-luminosity pointer-events-none"
        style={{ backgroundImage: "url('/assets/hero_banner_roblox.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/90 to-transparent pointer-events-none" />

      {/* Content Area */}
      <div className="relative z-10 flex items-start gap-4">
        <div className="w-10 h-10 rounded-md bg-zinc-950 border border-zinc-800 flex items-center justify-center text-white shrink-0">
          <Bell className="w-4 h-4" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-1.5 py-0.5 bg-white text-zinc-950 text-[10px] font-mono font-bold uppercase">
              KZ // NOTICE
            </span>
            <span className="text-zinc-600 select-none">/</span>
            <span className="text-zinc-400 font-mono text-[11px]">
              24H WARRANTY PROTECTION
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            เข้าร่วม Discord KaiZort เพื่อลุ้นรับไอดี Roblox ไก่ตันระดับ V4 ประจำสัปดาห์
          </h3>
          <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
            กรุณาบันทึกวิดีโอขณะเปิดและเข้าสู่ระบบไอดีครั้งแรก เพื่อความสะดวกรวดเร็วในการเคลมสินค้าภายในระยะประกัน 24 ชั่วโมง ทีมงานพร้อมเปลี่ยนไอดีใหม่ให้ทันที
          </p>
        </div>
      </div>

      {/* Action Button */}
      <a
        href={siteConfig.links.discord}
        className="relative z-10 shrink-0 px-4 py-2.5 rounded-md text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
      >
        <span>เข้าร่วมชุมชน KaiZort</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-zinc-950" />
      </a>
    </section>
  );
}
