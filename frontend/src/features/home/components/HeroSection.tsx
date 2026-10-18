"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
} from "lucide-react";

interface HeroSlide {
  id: string;
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
    tag: "แพลตฟอร์มซื้อขายไอดีเกม ROBLOX อันดับ 1",
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
    tag: "ระบบตรวจสอบและส่งมอบอัตโนมัติ 24/7",
    title: "คัดสรรไอดีไก่ตันระดับพรีเมียม",
    titleHighlight: "ความปลอดภัยสูงสุด ส่งมอบทันทีใน 0.8 วินาที",
    description:
      "รับประกันสินค้าทุกรายการด้วยระบบ Vault อัจฉริยะ ป้องกันการดึงกลับ 100% พร้อมทีมงานดูแลหลังการขายตลอด 24 ชั่วโมง",
    ctaText: "เลือกซื้อสินค้าทันที",
    ctaLink: "/products",
    secondaryText: "เงื่อนไขการรับประกัน",
    secondaryLink: "/support",
    image: "/assets/hero_banner_security.png",
  },
  {
    id: "slide_gaming_news",
    tag: "ข่าวสารเกมและอัปเดตแพตช์ระบบ",
    title: "อัปเดตข่าวสารวงการเกมและแพตช์ใหม่",
    titleHighlight: "เจาะลึกข้อมูลระบบ รีเซ็ตซีซัน และเทคนิคการเล่น",
    description:
      "ติดตามข่าวสารการอัปเดตแพตช์ล่าสุดของเกม Roblox ข้อมูลการปรับสมดุลผลปีศาจ ดาบใหม่ และกิจกรรมพิเศษ เพื่อความได้เปรียบในทุกการต่อสู้",
    ctaText: "อ่านสรุปข่าวสารแพตช์",
    ctaLink: "/support",
    secondaryText: "ดูหมวดหมู่สินค้า",
    secondaryLink: "/products",
    image: "/assets/hero_banner_gaming_news.png",
  },
  {
    id: "slide_community",
    tag: "สิทธิพิเศษสมาชิก DISCORD VIP",
    title: "เข้าร่วมคอมมูนิตี้เกมเมอร์ KAITAN",
    titleHighlight: "ลุ้นรับไอดีผลตื่นฟรีประจำสัปดาห์ และตั๋วเคลมด่วน",
    description:
      "สังคมคนเล่นเกม Roblox มากกว่า 15,000 คน อัปเดตโค้ดแจกฟรี พูดคุยแลกเปลี่ยน และรับสิทธิ์คุ้มครองพิเศษระดับ Diamond VIP",
    ctaText: "เข้าร่วม Discord VIP",
    ctaLink: "https://discord.gg",
    secondaryText: "ศูนย์บริการสมาชิก",
    secondaryLink: "/member/profile",
    image: "/assets/hero_banner_community.png",
  },
];

const AUTO_SLIDE_INTERVAL = 6000; // 6 seconds

export function HeroSection() {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);

  // Auto-play timer with progress bar
  useEffect(() => {
    if (isPaused) return;

    const tickInterval = 50; // update progress every 50ms
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

  const nextSlide = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
    setProgress(0);
  };

  const prevSlide = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
    setProgress(0);
  };

  const slide = slides[current];

  return (
    <section
      id="section-hero"
      aria-label="ไฮไลต์และโปรโมชั่น"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-obsidian-950 p-6 sm:p-10 lg:p-12 min-h-[360px] sm:min-h-[420px] flex flex-col justify-between shadow-[0_12px_48px_rgba(0,0,0,0.8)]"
    >
      {/* Background Banner Artwork with Multi-stage Vignette */}
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

      {/* Deep Obsidian Gradient Vignettes to maintain perfect contrast and readability */}
      <div className="absolute inset-0 bg-gradient-to-r from-obsidian-950 via-obsidian-950/85 to-transparent pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-t from-obsidian-950 via-transparent to-transparent pointer-events-none" />

      {/* Main Slide Content */}
      <div className="max-w-2xl space-y-4 relative z-10 animate-in fade-in duration-300 key={current}">
        {/* Clean Editorial Tag Label - No Box */}
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-blue-400">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>{slide.tag}</span>
        </div>

        {/* Title & Headline */}
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-snug">
          {slide.title} <br />
          <span className="text-slate-300 font-normal text-lg sm:text-2xl lg:text-3xl block mt-1">
            {slide.titleHighlight}
          </span>
        </h1>

        {/* Description */}
        <p className="text-slate-400 text-xs sm:text-sm leading-relaxed max-w-xl">
          {slide.description}
        </p>

        {/* CTA Buttons - Solid Pure Colors, No Gradient, No Glow */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Link
            href={slide.ctaLink}
            className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-white hover:bg-slate-200 transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>{slide.ctaText}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <Link
            href={slide.secondaryLink}
            className="px-4 py-2.5 rounded-xl text-xs font-medium text-slate-300 bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 transition-colors cursor-pointer"
          >
            {slide.secondaryText}
          </Link>
        </div>
      </div>

      {/* Bottom Luxury Progress Capsule & Slide Controls */}
      <div className="relative z-10 pt-6 mt-6 border-t border-white/[0.07] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {/* Slide Indicators with Progress Fill */}
        <div className="flex items-center gap-2">
          {slides.map((s, idx) => {
            const isActive = idx === current;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToSlide(idx)}
                aria-label={`ไปยังสไลด์ที่ ${idx + 1}`}
                className="group/pill relative h-1.5 rounded-full overflow-hidden transition-all duration-300 cursor-pointer"
                style={{ width: isActive ? "48px" : "18px" }}
              >
                {/* Background track */}
                <div className="absolute inset-0 bg-white/20 group-hover/pill:bg-white/30" />
                {/* Progress bar inside active pill - Solid white, no gradient */}
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

        {/* Controls: Counter + Prev/Next buttons */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <span className="text-xs font-mono font-semibold text-slate-400 num-tabular">
            0{current + 1} <span className="text-slate-600">/</span> 0{slides.length}
          </span>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={prevSlide}
              aria-label="สไลด์ก่อนหน้า"
              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextSlide}
              aria-label="สไลด์ถัดไป"
              className="w-8 h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
