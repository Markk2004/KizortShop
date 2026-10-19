"use client";

import React, { useState } from "react";
import {
  Plus,
  Layers,
  Edit,
  Trash2,
  Check,
  Eye,
  EyeOff,
  Upload,
  Image as ImageIcon,
} from "lucide-react";
import {
  AdminSmartFilterBar,
  type SearchFieldMode,
} from "@/features/admin/components/AdminSmartFilterBar";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";
import { useToast } from "@/common/components/ToastProvider";
import { mockCategories } from "@/mocks/catalog";
import type { Category } from "@/types";

export default function AdminCategoriesPage() {
  const { success, warning, error } = useToast();
  const [categories, setCategories] = useState<Category[]>(mockCategories);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchFieldMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "HIDDEN">("ALL");

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formDescription, setFormDescription] = useState("");
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

  const handleOpenAddModal = () => {
    setEditingCategory(null);
    setFormName("");
    setFormSlug("");
    setFormDescription("");
    setFormImage("");
    setFormIsActive(true);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (cat: Category) => {
    setEditingCategory(cat);
    setFormName(cat.name);
    setFormSlug(cat.id);
    setFormDescription(cat.description || "");
    setFormImage(cat.image || "");
    setFormIsActive(cat.status === "AVAILABLE");
    setIsModalOpen(true);
  };

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      error("กรุณาระบุชื่อหมวดหมู่", "ชื่อหมวดหมู่เป็นข้อมูลบังคับ");
      return;
    }

    const slug =
      formSlug.trim() ||
      formName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-");

    if (editingCategory) {
      // Update existing
      setCategories((prev) =>
        prev.map((c) =>
          c.id === editingCategory.id
            ? {
                ...c,
                id: slug,
                name: formName.trim(),
                description: formDescription.trim(),
                image: formImage || c.image,
                status: formIsActive ? "AVAILABLE" : "OUT_OF_STOCK",
              }
            : c
        )
      );
      success("บันทึกหมวดหมู่สำเร็จ", `แก้ไขหมวดหมู่ ${formName.trim()} เรียบร้อยแล้ว`);
    } else {
      // Create new
      const newCat: Category = {
        id: slug,
        name: formName.trim(),
        description: formDescription.trim(),
        image: formImage || "/assets/blox_fruits_category.jpg",
        itemCount: 0,
        priceMin: 0,
        priceMax: 0,
        accent: "amber",
        status: formIsActive ? "AVAILABLE" : "OUT_OF_STOCK",
      };
      setCategories((prev) => [newCat, ...prev]);
      success("สร้างหมวดหมู่ใหม่สำเร็จ", `เพิ่มหมวดหมู่ ${formName.trim()} สู่ระบบแล้ว`);
    }

    setIsModalOpen(false);
  };

  const handleToggleVisibility = (cat: Category) => {
    const isCurrentlyVisible = cat.status === "AVAILABLE";
    const nextStatus = isCurrentlyVisible ? "OUT_OF_STOCK" : "AVAILABLE";

    setCategories((prev) =>
      prev.map((c) => (c.id === cat.id ? { ...c, status: nextStatus } : c))
    );

    if (nextStatus === "AVAILABLE") {
      success("เปิดแสดงผลหมวดหมู่", `หมวดหมู่ ${cat.name} แสดงผลบนหน้าร้านแล้ว`);
    } else {
      warning("ซ่อนหมวดหมู่", `หมวดหมู่ ${cat.name} ถูกซ่อนจากการแสดงผลหน้าร้าน`);
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    setHardConfirmConfig({
      isOpen: true,
      title: "ยืนยันการลบหมวดหมู่เกม",
      description: `คุณต้องการลบหมวดหมู่ "${cat.name}" ออกจากระบบถาวรหรือไม่? สินค้าทั้งหมดที่สังกัดหมวดหมู่นี้จะสูญเสียการจัดหมวด`,
      targetItemName: `${cat.id} // ${cat.name}`,
      expectedKeyword: "DELETE",
      confirmLabel: "ลบหมวดหมู่ออกทันที",
      variant: "danger",
      onConfirm: () => {
        setCategories((prev) => prev.filter((c) => c.id !== cat.id));
        setHardConfirmConfig((prev) => ({ ...prev, isOpen: false }));
        warning("ลบหมวดหมู่สำเร็จ", `ลบหมวดหมู่ ${cat.name} เรียบร้อยแล้ว`);
      },
    });
  };

  const filteredCategories = categories.filter((cat) => {
    const isVisible = cat.status === "AVAILABLE";
    if (statusFilter === "ACTIVE" && !isVisible) return false;
    if (statusFilter === "HIDDEN" && isVisible) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      cat.id.toLowerCase().includes(q) ||
      cat.name.toLowerCase().includes(q) ||
      (cat.description && cat.description.toLowerCase().includes(q))
    );
  });

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
            KZ // CATALOG TAXONOMY
          </span>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Layers className="w-6 h-6 text-amber-500" />
            <span>จัดการหมวดหมู่เกมและบริการ</span>
          </h1>
          <p className="text-sm text-zinc-400">
            สร้าง ปรับแต่งรูปภาพปก และจัดระเบียบหมวดหมู่สินค้าที่วางจำหน่ายในหน้าร้าน
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAddModal}
          className="h-11 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer self-start sm:self-auto shrink-0"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>+ เพิ่มหมวดหมู่ใหม่</span>
        </button>
      </div>

      {/* Smart Filter Bar */}
      <AdminSmartFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchMode={searchMode}
        onSearchModeChange={setSearchMode}
        placeholder="ค้นหารหัสหมวดหมู่ (blox-fruits) หรือชื่อเกม..."
        totalMatched={filteredCategories.length}
        totalAll={categories.length}
      >
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-950 border border-zinc-800">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
              statusFilter === "ALL"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ทั้งหมด ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("ACTIVE")}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
              statusFilter === "ACTIVE"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            แสดงอยู่
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("HIDDEN")}
            className={`h-8 px-3 rounded-md text-xs font-mono transition-all cursor-pointer ${
              statusFilter === "HIDDEN"
                ? "bg-amber-500 text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ซ่อนไว้
          </button>
        </div>
      </AdminSmartFilterBar>

      {/* Categories Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredCategories.map((cat) => {
          const isVisible = cat.status === "AVAILABLE";

          return (
            <div
              key={cat.id}
              className="rounded-xl bg-zinc-900/70 border border-zinc-800 hover:border-zinc-700 overflow-hidden flex flex-col justify-between transition-all group shadow-sm"
            >
              {/* Category Cover Image 16:9 */}
              <div className="aspect-[16/9] bg-zinc-950 relative overflow-hidden border-b border-zinc-800">
                {cat.image ? (
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 gap-2">
                    <ImageIcon className="w-8 h-8 opacity-40 text-amber-500" />
                    <span className="text-xs">ยังไม่มีรูปภาพ</span>
                  </div>
                )}

                {/* Status Badge overlay */}
                <div className="absolute top-3 right-3">
                  {isVisible ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>แสดงหน้าร้าน</span>
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-950/80 text-zinc-400 border border-zinc-700 backdrop-blur-sm flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                      <span>ซ่อนไว้</span>
                    </span>
                  )}
                </div>

                <div className="absolute bottom-3 left-3">
                  <span className="px-2 py-0.5 rounded bg-zinc-950/90 text-amber-400 font-mono text-xs font-bold border border-amber-500/30 backdrop-blur-sm">
                    {cat.id}
                  </span>
                </div>
              </div>

              {/* Details & Actions */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors">
                    {cat.name}
                  </h3>
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {cat.description || "ไม่มีคำอธิบายสำหรับหมวดหมู่นี้"}
                  </p>
                </div>

                <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs font-mono text-zinc-400">
                  <span>
                    สินค้าในระบบ: <strong className="text-white">{cat.itemCount || 0}</strong> ชิ้น
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(cat)}
                      title={isVisible ? "คลิกเพื่อซ่อนหมวดหมู่" : "คลิกเพื่อแสดงหน้าร้าน"}
                      className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(cat)}
                      title="แก้ไขหมวดหมู่"
                      className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-800 text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer"
                    >
                      <Edit className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat)}
                      title="ลบหมวดหมู่ (ยืนยัน 2 ขั้น)"
                      className="p-2 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-red-500/10 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Category Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-zinc-950 border border-zinc-800 p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-white">
                {editingCategory ? "แก้ไขหมวดหมู่เกม" : "เพิ่มหมวดหมู่เกมใหม่"}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-400 hover:text-white text-sm"
              >
                ปิด
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  ชื่อหมวดหมู่ <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="เช่น ไก่ตัน Blox Fruits"
                  className="w-full h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  รหัสหมวดหมู่ (Slug / Key)
                </label>
                <input
                  type="text"
                  value={formSlug}
                  onChange={(e) => setFormSlug(e.target.value)}
                  placeholder="เช่น blox-fruits (เว้นว่างเพื่อสร้างอัตโนมัติ)"
                  className="w-full h-11 px-4 rounded-lg bg-zinc-900 border border-zinc-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  คำอธิบายหมวดหมู่
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="คำอธิบายสั้นสำหรับแสดงใต้ชื่อหมวดหมู่"
                  className="w-full p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Image Upload Area */}
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">
                  รูปภาพปกหมวดหมู่ (แนะนำ 16:9)
                </label>
                <label className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-900/60 transition-all cursor-pointer text-center">
                  {formImage ? (
                    <div className="relative aspect-[16/9] w-full max-h-36 overflow-hidden rounded-lg mb-2">
                      <img
                        src={formImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <Upload className="w-6 h-6 text-zinc-500 mb-1" />
                  )}
                  <span className="text-xs text-zinc-300 font-medium">
                    คลิกเพื่อเลือกไฟล์ หรือเปลี่ยนรูปภาพ
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
                <span className="text-xs font-medium text-zinc-300">แสดงผลบนหน้าร้านทันที</span>
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
                  บันทึกหมวดหมู่
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
