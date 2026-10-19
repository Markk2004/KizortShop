"use client";

import React, { useState } from "react";
import {
  Plus,
  Image as ImageIcon,
  Edit,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Upload,
  ExternalLink,
} from "lucide-react";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";
import { useToast } from "@/common/components/ToastProvider";

export interface BannerSlide {
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
  isActive: boolean;
}

const initialBanners: BannerSlide[] = [
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
    isActive: true,
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
    isActive: true,
  },
  {
    id: "slide_bloxfruits",
    code: "KZ // 03",
    tag: "BLOX FRUITS GODHUMAN AWAKENING",
    title: "ไก่ตัน Blox Fruits V4 สมบูรณ์แบบ",
    titleHighlight: "ดาบคู่ Cursed Dual Katana + ผลเสือขาว Kitsune ตื่น",
    description:
      "ฟาร์มครบทุกเกาะ สแตทตัน การันตียูนิตและผลปีศาจระดับตำนาน",
    ctaText: "ดูสินค้า Blox Fruits",
    ctaLink: "/products",
    secondaryText: "รีวิวจากลูกค้า",
    secondaryLink: "/reviews",
    image: "/assets/hero_banner_bloxfruits.png",
    isActive: true,
  },
];

export default function AdminBannersPage() {
  const { success, warning } = useToast();
  const [banners, setBanners] = useState<BannerSlide[]>(initialBanners);

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerSlide | null>(null);

  // Form Fields
  const [formTag, setFormTag] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formTitleHighlight, setFormTitleHighlight] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formCtaText, setFormCtaText] = useState("");
  const [formCtaLink, setFormCtaLink] = useState("");
  const [formSecondaryText, setFormSecondaryText] = useState("");
  const [formSecondaryLink, setFormSecondaryLink] = useState("");
  const [formImage, setFormImage] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);

  // Hard Confirmation Modal State
  const [hardConfirmConfig, setHardConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    targetItemName?: string;
    expectedKeyword?: string;
    confirmLabel?: string;
    variant?: "danger" | "warning" | "amber";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    description: "",
    onConfirm: () => {},
  });

  const handleOpenAdd = () => {
    setEditingBanner(null);
    setFormTag("KAIZORT ANNOUNCEMENT // SPECIAL EVENT");
    setFormTitle("");
    setFormTitleHighlight("");
    setFormDescription("");
    setFormCtaText("เลือกดูสินค้า");
    setFormCtaLink("/products");
    setFormSecondaryText("รายละเอียดเพิ่มเติม");
    setFormSecondaryLink("/support");
    setFormImage("");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (b: BannerSlide) => {
    setEditingBanner(b);
    setFormTag(b.tag);
    setFormTitle(b.title);
    setFormTitleHighlight(b.titleHighlight);
    setFormDescription(b.description);
    setFormCtaText(b.ctaText);
    setFormCtaLink(b.ctaLink);
    setFormSecondaryText(b.secondaryText);
    setFormSecondaryLink(b.secondaryLink);
    setFormImage(b.image);
    setFormIsActive(b.isActive);
    setIsModalOpen(true);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      return;
    }

    if (editingBanner) {
      setBanners((prev) =>
        prev.map((b) =>
          b.id === editingBanner.id
            ? {
                ...b,
                tag: formTag.trim(),
                title: formTitle.trim(),
                titleHighlight: formTitleHighlight.trim(),
                description: formDescription.trim(),
                ctaText: formCtaText.trim() || "ดูรายละเอียด",
                ctaLink: formCtaLink.trim() || "/products",
                secondaryText: formSecondaryText.trim(),
                secondaryLink: formSecondaryLink.trim(),
                image: formImage || b.image,
                isActive: formIsActive,
              }
            : b
        )
      );
      success("อัปเดตแบนเนอร์สำเร็จ", "บันทึกข้อมูลภาพสไลด์หน้าร้านเรียบร้อยแล้ว");
    } else {
      const newSlide: BannerSlide = {
        id: `slide_${Date.now()}`,
        code: `KZ // 0${banners.length + 1}`,
        tag: formTag.trim(),
        title: formTitle.trim(),
        titleHighlight: formTitleHighlight.trim(),
        description: formDescription.trim(),
        ctaText: formCtaText.trim() || "ดูรายละเอียด",
        ctaLink: formCtaLink.trim() || "/products",
        secondaryText: formSecondaryText.trim(),
        secondaryLink: formSecondaryLink.trim(),
        image: formImage || "/assets/hero_banner_roblox.png",
        isActive: formIsActive,
      };
      setBanners((prev) => [...prev, newSlide]);
      success("เพิ่มแบนเนอร์ใหม่สำเร็จ", "ภาพสไลด์ถูกบรรจุเข้าสู่ลำดับการแสดงผลหน้าร้านแล้ว");
    }

    setIsModalOpen(false);
  };

  const handleMove = (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= banners.length) return;

    const next = [...banners];
    const temp = next[index];
    next[index] = next[targetIndex];
    next[targetIndex] = temp;

    // Re-code slides
    const updated = next.map((item, i) => ({
      ...item,
      code: `KZ // 0${i + 1}`,
    }));

    setBanners(updated);
    success("จัดเรียงลำดับแบนเนอร์สำเร็จ", `สลับตำแหน่งสไลด์ลำดับที่ ${index + 1} และ ${targetIndex + 1} แล้ว`);
  };

  const handleToggleActive = (b: BannerSlide) => {
    setBanners((prev) =>
      prev.map((item) =>
        item.id === b.id ? { ...item, isActive: !item.isActive } : item
      )
    );
    if (!b.isActive) {
      success("เปิดการแสดงผลสไลด์", `สไลด์ ${b.code} แสดงผลบนหน้าแรกแล้ว`);
    } else {
      warning("ปิดการแสดงผลสไลด์", `สไลด์ ${b.code} ถูกซ่อนจากการวนสไลด์`);
    }
  };

  const handleDeleteBanner = (b: BannerSlide) => {
    setHardConfirmConfig({
      isOpen: true,
      title: "ยืนยันการลบภาพสไลด์แบนเนอร์",
      description: `ต้องการลบแบนเนอร์ ${b.code} ("${b.title}") ออกจากระบบหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      targetItemName: `${b.code} — ${b.title}`,
      expectedKeyword: "DELETE",
      confirmLabel: "ลบแบนเนอร์ทันที",
      variant: "danger",
      onConfirm: () => {
        setBanners((prev) => prev.filter((item) => item.id !== b.id));
        setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        warning("ลบแบนเนอร์สำเร็จ", `ลบสไลด์ ${b.code} เรียบร้อยแล้ว`);
      },
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 2-Step Hard Confirmation Modal */}
      <HardConfirmModal
        isOpen={hardConfirmConfig.isOpen}
        title={hardConfirmConfig.title}
        description={hardConfirmConfig.description}
        targetItemName={hardConfirmConfig.targetItemName}
        expectedKeyword={hardConfirmConfig.expectedKeyword}
        confirmLabel={hardConfirmConfig.confirmLabel}
        variant={hardConfirmConfig.variant}
        onConfirm={hardConfirmConfig.onConfirm}
        onCancel={() => setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
        <div className="space-y-1">
          <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest block">
            KZ // STOREFRONT SHOWCASE
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ImageIcon className="w-6 h-6 text-amber-500" />
            <span>จัดการแบนเนอร์ & ประกาศหน้าร้าน</span>
          </h1>
          <p className="text-sm text-zinc-400">
            ปรับแต่งภาพสไลด์ Hero Carousel บนหน้าแรก ลิงก์ปลายทาง และลำดับการแสดงผล
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="h-11 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ เพิ่มแบนเนอร์ใหม่</span>
        </button>
      </div>

      {/* Banner Cards List */}
      <div className="space-y-4">
        {banners.map((b, index) => {
          return (
            <div
              key={b.id}
              className={`rounded-xl bg-zinc-900/70 border transition-all p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-6 shadow-sm ${
                b.isActive ? "border-zinc-800 hover:border-zinc-700" : "border-zinc-800/50 opacity-60"
              }`}
            >
              {/* Left: 16:9 Banner Thumbnail */}
              <div className="w-full lg:w-72 aspect-[16/9] rounded-lg overflow-hidden bg-zinc-950 relative border border-zinc-800 shrink-0">
                <img
                  src={b.image}
                  alt={b.title}
                  className="w-full h-full object-cover"
                />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded bg-zinc-950/90 text-amber-400 font-mono text-xs font-bold border border-amber-500/30 backdrop-blur-sm">
                  {b.code}
                </span>

                <span
                  className={`absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold backdrop-blur-sm ${
                    b.isActive
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : "bg-zinc-950/80 text-zinc-400 border border-zinc-700"
                  }`}
                >
                  {b.isActive ? "ACTIVE" : "HIDDEN"}
                </span>
              </div>

              {/* Middle: Content Info */}
              <div className="flex-1 min-w-0 space-y-2">
                <span className="text-xs font-mono text-amber-500/90 block font-semibold">
                  {b.tag}
                </span>
                <h3 className="text-base font-bold text-white leading-snug">
                  {b.title}{" "}
                  {b.titleHighlight && (
                    <span className="text-amber-400">{b.titleHighlight}</span>
                  )}
                </h3>
                <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                  {b.description}
                </p>

                {/* CTA Links info */}
                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs font-mono text-zinc-400">
                  <span className="flex items-center gap-1 text-zinc-300">
                    <ExternalLink className="w-3.5 h-3.5 text-amber-500" />
                    <span>ปุ่มหลัก: "{b.ctaText}" → {b.ctaLink}</span>
                  </span>
                  {b.secondaryText && (
                    <span>· ปุ่มรอง: "{b.secondaryText}" → {b.secondaryLink}</span>
                  )}
                </div>
              </div>

              {/* Right: Controls & Reordering */}
              <div className="flex flex-wrap lg:flex-col items-center justify-end gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-zinc-800">
                {/* Move Up / Down Buttons */}
                <div className="flex items-center gap-1.5 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMove(index, "up")}
                    title="เลื่อนขึ้น"
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-mono text-zinc-500 px-1 font-bold">
                    #{index + 1}
                  </span>
                  <button
                    type="button"
                    disabled={index === banners.length - 1}
                    onClick={() => handleMove(index, "down")}
                    title="เลื่อนลง"
                    className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(b)}
                    title={b.isActive ? "ซ่อนแบนเนอร์" : "เปิดแสดงผล"}
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {b.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEdit(b)}
                    title="แก้ไขแบนเนอร์"
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteBanner(b)}
                    title="ลบแบนเนอร์ (ยืนยัน 2 ขั้น)"
                    className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Banner Add / Edit Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingBanner ? "แก้ไขภาพสไลด์แบนเนอร์" : "เพิ่มแบนเนอร์ประกาศใหม่"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ปิด
              </button>
            </div>

            <form onSubmit={handleSaveBanner} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  Tag ข้อความบน (Upper Tag)
                </label>
                <input
                  type="text"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                  placeholder="เช่น KAIZORT ROBLOX VAULT SYSTEM"
                  className="w-full h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    หัวข้อหลัก <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="เช่น ศูนย์รวมไอดีไก่ตันระดับท็อป"
                    className="w-full h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    ข้อความเน้น (สีอำพัน)
                  </label>
                  <input
                    type="text"
                    value={formTitleHighlight}
                    onChange={(e) => setFormTitleHighlight(e.target.value)}
                    placeholder="เช่น ส่งมอบไวใน 0.8 วินาที"
                    className="w-full h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-amber-400 text-sm focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  คำอธิบายรายละเอียด
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="คำอธิบายสิทธิประโยชน์หรือโปรโมชันสำหรับลูกค้า"
                  className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* CTA Buttons Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    ข้อความปุ่มหลัก & ลิงก์
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formCtaText}
                      onChange={(e) => setFormCtaText(e.target.value)}
                      placeholder="เช่น เลือกซื้อทันที"
                      className="w-1/2 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={formCtaLink}
                      onChange={(e) => setFormCtaLink(e.target.value)}
                      placeholder="/products"
                      className="w-1/2 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    ข้อความปุ่มรอง & ลิงก์ (ถ้ามี)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formSecondaryText}
                      onChange={(e) => setFormSecondaryText(e.target.value)}
                      placeholder="เช่น เงื่อนไขประกัน"
                      className="w-1/2 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-xs focus:outline-none focus:border-amber-500"
                    />
                    <input
                      type="text"
                      value={formSecondaryLink}
                      onChange={(e) => setFormSecondaryLink(e.target.value)}
                      placeholder="/support"
                      className="w-1/2 h-10 px-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* Image Upload Area 16:9 */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  รูปภาพแบนเนอร์ (แนะนำอัตราส่วน 16:9)
                </label>
                <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-900/60 transition-all cursor-pointer text-center">
                  {formImage ? (
                    <div className="relative aspect-[16/9] w-full max-h-48 overflow-hidden rounded-lg mb-2">
                      <img
                        src={formImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                  )}
                  <span className="text-xs text-zinc-300 font-medium">
                    คลิกเพื่อเลือกไฟล์ หรือลากรูปภาพมาวางที่นี่
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setFormImage(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>

              {/* Publish Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                <span className="text-xs font-medium text-zinc-300">เปิดแสดงผลวนสไลด์หน้าร้านทันที</span>
                <input
                  type="checkbox"
                  checked={formIsActive}
                  onChange={(e) => setFormIsActive(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-500 focus:ring-amber-500 cursor-pointer"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="h-10 px-4 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs"
                >
                  บันทึกแบนเนอร์
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
