"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ShoppingCart } from "lucide-react";
import { siteConfig } from "@/config/site";

interface HeroSlide {
  id: string;
  code: string;
  tag: string;
  title: string;
  titleHighlight: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  secondaryText: string;
  secondaryLink: string;
  image: string;
}

const slides: HeroSlide[] = [
  {
    id: "slide_roblox",
    code: "KZ // 01",
    tag: "KAIZORT ROBLOX VAULT SYSTEM",
    title: "ศูนย์รวมไอดีเกม Roblox ไก่ตันระดับท็อป",
    titleHighlight: "ปลดล็อกผลปีศาจตื่น ดาบคู่ และไอเทมแรร์ครบทุกแมพ",
    description:
      "รหัสผ่านปลอดภัย 100% ไม่ติดเบอร์ ไม่ติดอีเมล พร้อมเข้าเล่นได้ทันที จัดส่งรหัสผ่านระบบอัตโนมัติใน 0.8 วินาที",
    ctaText: "เลือกซื้อไอดี Roblox",
    ctaLink: "/products",
    secondaryText: "ดูหมวดหมู่ทั้งหมด",
    secondaryLink: "/products",
    image: "/assets/hero_banner_roblox.png",
  },
  {
    id: "slide_security",
    code: "KZ // 02",
    tag: "24/7 AUTOMATED ESCROW & VAULT",
    title: "คัดสรรไอดีไก่ตันระดับพรีเมียม",
    titleHighlight: "ความปลอดภัยสูงสุด ส่งมอบทันทีใน 0.8 วินาที",
    description:
      "รับประกันสินค้าทุกรายการด้วยระบบ KaiZort Vault เข้ารหัส AES-256 ป้องกันการดึงกลับ 100% พร้อมทีมงานดูแลตลอด 24 ชั่วโมง",
    ctaText: "เลือกซื้อสินค้าทันที",
    ctaLink: "/products",
    secondaryText: "เงื่อนไขการรับประกัน",
    secondaryLink: "/support",
    image: "/assets/hero_banner_security.png",
  },
  {
    id: "slide_gaming_news",
    code: "KZ // 03",
    tag: "PATCH NOTES & META UPDATES",
    title: "อัปเดตข่าวสารวงการเกมและแพตช์ใหม่",
    titleHighlight: "เจาะลึกข้อมูลระบบ รีเซ็ตซีซัน และเทคนิคการเล่น",
    description:
      "ติดตามข่าวสารการอัปเดตแพตช์ล่าสุดของเกม Roblox ข้อมูลการปรับสมดุลผลปีศาจ ดาบใหม่ และกิจกรรมพิเศษจาก KaiZort",
    ctaText: "อ่านสรุปข่าวสารแพตช์",
    ctaLink: "/support",
    secondaryText: "ดูหมวดหมู่สินค้า",
    secondaryLink: "/products",
    image: "/assets/hero_banner_gaming_news.png",
  },
  {
    id: "slide_community",
    code: "KZ // 04",
    tag: "DISCORD VIP COMMUNITY",
    title: "เข้าร่วมคอมมูนิตี้เกมเมอร์ KaiZort",
    titleHighlight: "ลุ้นรับไอดีผลตื่นฟรีประจำสัปดาห์ และตั๋วเคลมด่วน",
    description:
      "สังคมคนเล่นเกม Roblox มากกว่า 15,000 คน อัปเดตโค้ดแจกฟรี พูดคุยแลกเปลี่ยน และรับสิทธิ์แจ้งเตือนรหัสผ่านทาง Discord DM",
    ctaText: "เข้าร่วม Discord VIP",
    ctaLink: "https://discord.gg",
    secondaryText: "ศูนย์บริการสมาชิก",
    secondaryLink: "/member/profile",
    image: "/assets/hero_banner_community.png",
  },
];

const AUTO_SLIDE_INTERVAL = 6000;

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isPaused) return;

    const tickInterval = 50;
    const step = (tickInterval / AUTO_SLIDE_INTERVAL) * 100;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          setCurrent((curr) => (curr + 1) % slides.length);
          return 0;
        }
        return prev + step;
      });
    }, tickInterval);

    return () => clearInterval(timer);
  }, [isPaused, current]);

  const goToSlide = (idx: number) => {
    setCurrent(idx);
    setProgress(0);
  };



  const slide = slides[current];

  return (
    <section
      id="section-hero"
      aria-label="ไฮไลต์และโปรโมชั่น KaiZort"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative rounded-lg overflow-hidden border border-zinc-800 bg-obsidian-950 p-6 sm:p-10 lg:p-12 min-h-[360px] sm:min-h-[410px] flex flex-col justify-between"
    >
      {/* Background Banner Artwork */}
      {slides.map((s, idx) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out pointer-events-none ${
            idx === current ? "opacity-35" : "opacity-0"
          }`}
        >
          <img
            src={s.image}
            alt={s.title}
            className="w-full h-full object-cover object-center"
          />
        </div>
      ))}

      {/* Crisp Matte Obsidian Vignette */}
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/90 to-obsidian-950/20 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent pointer-events-none" />


      {/* Main Slide Content */}
      <div className="max-w-2xl space-y-4 relative z-10">
        <div className="flex items-center gap-2.5 text-[11px] font-mono tracking-widest uppercase">
          <span className="px-1.5 py-0.5 bg-white text-zinc-950 font-bold">
            {slide.code}
          </span>
          <span className="text-zinc-300 font-semibold">{slide.tag}</span>
        </div>

        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-snug">
          {slide.title}
          <span className="text-zinc-300 font-normal text-lg sm:text-2xl lg:text-2xl block mt-1.5">
            {slide.titleHighlight}
          </span>
        </h1>

        <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed max-w-xl">
          {slide.description}
        </p>

        {/* High-Contrast Architectural CTA Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href={slide.ctaLink}
            className="px-5 py-2.5 rounded-md text-xs font-semibold text-zinc-950 bg-white hover:bg-zinc-200 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{slide.ctaText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={slide.secondaryLink}
            className="px-4 py-2.5 rounded-md text-xs font-medium text-zinc-200 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700 transition-colors cursor-pointer"
          >
            {slide.secondaryText}
          </Link>
        </div>
      </div>

      {/* Bottom Architectural Progress Bar & Slide Controls */}
      <div className="relative z-10 pt-6 mt-6 border-t border-zinc-800/90 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {slides.map((s, idx) => {
            const isActive = idx === current;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSlide(idx)}
                aria-label={`ไปยังสไลด์ที่ ${idx + 1}`}
                className="relative h-1.5 overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ width: isActive ? "52px" : "20px" }}
              >
                <div className="absolute inset-0 bg-zinc-800" />
                {isActive && (
                  <div
                    className="absolute inset-0 bg-white"
                    style={{ width: `${progress}%` }}
                  />
                )}
              </button>
            );
          })}
        </div>

      </div>
    </section>
  );
}
