import { ArrowUpRight, Bell } from "lucide-react";
import { siteConfig } from "@/config/site";

export function AnnouncementBar() {
  return (
    <section
      id="section-vip"
      className="luxury-card relative rounded-2xl overflow-hidden p-6 sm:p-7 backdrop-blur-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 border border-white/10"
    >
      {/* Background Roblox Artwork with Dark Vignette */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-25 mix-blend-luminosity pointer-events-none"
        style={{ backgroundImage: "url('/assets/hero_banner_roblox.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/85 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent pointer-events-none" />

      {/* Content Area - Clean Typography, No Badge Boxes, No Glows */}
      <div className="relative z-10 flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-300 shrink-0">
          <Bell className="w-4 h-4 text-slate-300" />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold tracking-wider text-blue-400 uppercase">
              ROBLOX ANNOUNCEMENT
            </span>
            <span className="text-slate-600 select-none">•</span>
            <span className="text-slate-400 font-medium">คุ้มครองไอดี 24 ชม.</span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-white tracking-tight">
            เข้าร่วม Discord เพื่อรับสิทธิ์ลุ้นรับไอดี Roblox ไก่ตันระดับ V4 ประจำสัปดาห์
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
            กรุณาบันทึกวิดีโอขณะเปิดและเข้าสู่ระบบไอดีครั้งแรก เพื่อความสะดวกรวดเร็วในการเคลมสินค้าหากเกิดปัญหา ทีมงานพร้อมดูแลและเคลมเปลี่ยนไอดีใหม่ทันที
          </p>
        </div>
      </div>

      {/* Action Button - Pure Solid, No Gradient, No Glow */}
      <a
        href={siteConfig.links.discord}
        className="relative z-10 shrink-0 px-4 py-2.5 rounded-xl text-xs font-medium text-white bg-white/[0.08] hover:bg-white/[0.14] border border-white/10 transition-colors flex items-center gap-2 cursor-pointer self-stretch sm:self-auto justify-center"
      >
        <span>เข้าร่วมชุมชน VIP</span>
        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
      </a>
    </section>
  );
}
