import Link from "next/link";
import { siteConfig } from "@/config/site";

export function Footer() {
  return (
    <footer className="pt-8 border-t border-white/[0.07] text-[11px] text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4 pb-8">
      <p>© 2026 {siteConfig.name} {siteConfig.tagline}. สงวนลิขสิทธิ์ตามกฎหมาย.</p>
      <div className="flex items-center gap-5 text-slate-400">
        <Link href="/support" className="hover:text-white transition-colors">
          เงื่อนไขการเคลม
        </Link>
        <Link href="/support" className="hover:text-white transition-colors">
          นโยบายความเป็นส่วนตัว
        </Link>
        <a href={siteConfig.links.discord} className="hover:text-white transition-colors">
          Discord ชุมชน
        </a>
      </div>
    </footer>
  );
}
