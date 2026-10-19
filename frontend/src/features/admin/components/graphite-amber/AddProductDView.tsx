"use client";

import React, { useState, useId } from "react";
import {
  ArrowLeft,
  Check,
  Upload,
  AlertTriangle,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { formatBaht } from "@/lib/format";
import type { GraphiteProduct } from "./ProductsDView";
import { HardConfirmModal } from "@/features/admin/components/HardConfirmModal";

interface AddProductDViewProps {
  onBack: () => void;
  onSaveProduct: (newProduct: GraphiteProduct, stockItems: string[]) => void;
  initialProduct?: GraphiteProduct | null;
}

export function AddProductDView({
  onBack,
  onSaveProduct,
  initialProduct,
}: AddProductDViewProps) {
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Form State
  const [title, setTitle] = useState(initialProduct?.title || "");
  const [sku, setSku] = useState(initialProduct?.code || "");
  const [category, setCategory] = useState(initialProduct?.category || "Blox Fruits");
  const [description, setDescription] = useState(
    "ไอดีแท้ 100% ปลอดภัย ไร้ประวัติแบน พร้อมส่งมอบข้อมูลทันทีหลังชำระเงิน"
  );
  const [imageUrl, setImageUrl] = useState("");

  const [price, setPrice] = useState(initialProduct?.price ? String(initialProduct.price) : "");
  const [originalPrice, setOriginalPrice] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState<"AUTO_DISPATCH" | "ADMIN_MANUAL">(
    "AUTO_DISPATCH"
  );
  const [warranty, setWarranty] = useState("24 ชั่วโมง");

  const [rawStock, setRawStock] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(true);

  // HTML IDs for Accessibility
  const titleId = useId();
  const skuId = useId();
  const catId = useId();
  const descId = useId();
  const priceId = useId();
  const origPriceId = useId();
  const costPriceId = useId();
  const warrantyId = useId();
  const stockAreaId = useId();

  // Stock parsing & duplicate detection
  const stockLines = rawStock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const uniqueStockLines = Array.from(new Set(stockLines));
  const duplicateCount = stockLines.length - uniqueStockLines.length;
  const stockCount = deliveryMethod === "AUTO_DISPATCH" ? uniqueStockLines.length : 1;

  // 4-Step Progress Calculations
  const isStep1Done = title.trim().length > 0;
  const numPrice = parseFloat(price);
  const isStep2Done = !isNaN(numPrice) && numPrice > 0;
  const isStep3Done = deliveryMethod === "ADMIN_MANUAL" || uniqueStockLines.length > 0;
  const isStep4Done = isStep1Done && isStep2Done && isStep3Done;

  const isDirty = title.trim().length > 0 || price.trim().length > 0 || rawStock.trim().length > 0;

  const handleRequestCancel = () => {
    if (isDirty) {
      setShowCancelModal(true);
    } else {
      onBack();
    }
  };

  // Missing Fields Tracker
  const missingFields: string[] = [];
  if (!isStep1Done) missingFields.push("ชื่อสินค้า");
  if (!isStep2Done) missingFields.push("ราคาขาย");
  if (deliveryMethod === "AUTO_DISPATCH" && uniqueStockLines.length === 0) {
    missingFields.push("สต็อกรหัส");
  }

  const handleSave = (isDraft = false) => {
    if (!isStep4Done && !isDraft) return;

    const generatedCode =
      sku.trim() ||
      `${category === "Blox Fruits" ? "BF" : category === "Anime Defenders" ? "AD" : "KZ"}-${Date.now().toString().slice(-4)}`;

    const newProd: GraphiteProduct = {
      id: initialProduct?.id || `p-${Date.now()}`,
      code: generatedCode.toUpperCase(),
      title: title.trim(),
      category,
      price: isNaN(numPrice) ? 0 : numPrice,
      stock: deliveryMethod === "AUTO_DISPATCH" ? uniqueStockLines.length : 99,
      status: publishImmediately && !isDraft && stockCount > 0 ? "AVAILABLE" : "OUT_OF_STOCK",
      sold: initialProduct?.sold || 0,
    };

    onSaveProduct(newProd, uniqueStockLines);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 2-Step Cancel Confirmation Modal */}
      <HardConfirmModal
        isOpen={showCancelModal}
        title="ยืนยันการยกเลิกการแก้ไขข้อมูลสินค้า"
        description="คุณมีข้อมูลที่กรอกค้างไว้ในแบบฟอร์ม หากกดยกเลิก ข้อมูลที่กรอกทั้งหมดรวมถึงรายการสต็อกไอดีจะไม่ถูกบันทึกเข้าสู่ระบบ"
        expectedKeyword="DISCARD"
        confirmLabel="ละทิ้งข้อมูลและออก"
        variant="warning"
        onConfirm={() => {
          setShowCancelModal(false);
          onBack();
        }}
        onCancel={() => setShowCancelModal(false)}
      />

      {/* 5.1 Header & Back link */}
      <div className="space-y-4 pb-2 border-b border-zinc-800">
        <button
          type="button"
          onClick={handleRequestCancel}
          className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-amber-400 transition-colors cursor-pointer py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>← กลับไปรายการสินค้า</span>
        </button>

        <h1 className="text-2xl font-bold text-white tracking-tight">
          {initialProduct ? "แก้ไขข้อมูลสินค้า" : "เพิ่มสินค้าใหม่"}
        </h1>

        {/* 4-Step Horizontal Progress Cards */}
        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1"
          role="region"
          aria-label="ความคืบหน้าการกรอกข้อมูล"
        >
          {/* Step 1 */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isStep1Done
                ? "bg-emerald-950/40 border-emerald-500/30 text-white"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isStep1Done
                    ? "bg-emerald-500 text-zinc-950"
                    : "bg-zinc-800 text-amber-400 border border-amber-500/40"
                }`}
              >
                {isStep1Done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "1"}
              </span>
              <span className="text-sm font-semibold">ข้อมูลสินค้า</span>
            </div>
            <p className="text-xs mt-1 text-zinc-400">
              {isStep1Done ? "กรอกชื่อสินค้าแล้ว" : "ต้องระบุชื่อสินค้า"}
            </p>
          </div>

          {/* Step 2 */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isStep2Done
                ? "bg-emerald-950/40 border-emerald-500/30 text-white"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isStep2Done
                    ? "bg-emerald-500 text-zinc-950"
                    : "bg-zinc-800 text-amber-400 border border-amber-500/40"
                }`}
              >
                {isStep2Done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "2"}
              </span>
              <span className="text-sm font-semibold">ราคา</span>
            </div>
            <p className="text-xs mt-1 text-zinc-400">
              {isStep2Done ? `${formatBaht(numPrice)}` : "ราคามากกว่า ฿0"}
            </p>
          </div>

          {/* Step 3 */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isStep3Done
                ? "bg-emerald-950/40 border-emerald-500/30 text-white"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isStep3Done
                    ? "bg-emerald-500 text-zinc-950"
                    : "bg-zinc-800 text-amber-400 border border-amber-500/40"
                }`}
              >
                {isStep3Done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "3"}
              </span>
              <span className="text-sm font-semibold">สต็อก</span>
            </div>
            <p className="text-xs mt-1 text-zinc-400">
              {deliveryMethod === "ADMIN_MANUAL"
                ? "ส่งโดยแอดมิน"
                : isStep3Done
                ? `มีรหัส ${uniqueStockLines.length} รายการ`
                : "ยังไม่มีสต็อกรหัส"}
            </p>
          </div>

          {/* Step 4 */}
          <div
            className={`p-3.5 rounded-xl border transition-all ${
              isStep4Done
                ? "bg-emerald-950/40 border-emerald-500/30 text-white"
                : "bg-zinc-900/60 border-zinc-800 text-zinc-400"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isStep4Done
                    ? "bg-emerald-500 text-zinc-950"
                    : "bg-zinc-800 text-amber-400 border border-amber-500/40"
                }`}
              >
                {isStep4Done ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : "4"}
              </span>
              <span className="text-sm font-semibold">เผยแพร่</span>
            </div>
            <p className="text-xs mt-1 text-zinc-400">
              {publishImmediately ? "เปิดขายทันที" : "บันทึกเป็นฉบับร่าง"}
            </p>
          </div>
        </div>
      </div>

      {/* Main 2-Column Grid: Left (Form 3 Cards) / Right (Sticky Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form Cards */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Product Information */}
          <div className="p-6 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-white">ข้อมูลสินค้า</h2>

            {/* Title Field */}
            <div className="space-y-1.5">
              <label htmlFor={titleId} className="block text-sm font-medium text-zinc-200">
                ชื่อสินค้า <span className="text-red-400">*</span>
              </label>
              <input
                id={titleId}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="เช่น ไก่ตัน Blox Fruits V4 ผ่าไซบอร์กหมัดก็อด"
                className="w-full h-11 px-4 rounded-lg bg-zinc-950 border border-zinc-800 text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
              <p className="text-xs text-zinc-400">
                ควรระบุชื่อเกมและจุดเด่นของไอดีให้ชัดเจนเพื่อให้ลูกค้าตัดสินใจได้ง่าย
              </p>
            </div>

            {/* SKU and Category Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={skuId} className="block text-sm font-medium text-zinc-200">
                  รหัสสินค้า (SKU)
                </label>
                <input
                  id={skuId}
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="ว่างไว้ได้ ระบบสร้างให้อัตโนมัติ"
                  className="w-full h-11 px-4 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-sm placeholder-zinc-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor={catId} className="block text-sm font-medium text-zinc-200">
                  หมวดหมู่สินค้า
                </label>
                <select
                  id={catId}
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full h-11 px-4 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all cursor-pointer"
                >
                  <option value="Blox Fruits">Blox Fruits</option>
                  <option value="Anime Defenders">Anime Defenders</option>
                  <option value="Anime Dice / RNG">Anime Dice / RNG</option>
                  <option value="อื่น ๆ">อื่น ๆ</option>
                </select>
              </div>
            </div>

            {/* Description Textarea */}
            <div className="space-y-1.5">
              <label htmlFor={descId} className="block text-sm font-medium text-zinc-200">
                รายละเอียดสินค้า
              </label>
              <textarea
                id={descId}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3.5 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm leading-relaxed resize-y focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
              />
            </div>

            {/* Product Image Drop Area */}
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-zinc-200">รูปสินค้า</span>
              <label className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-dashed border-zinc-800 hover:border-amber-500/50 bg-zinc-950/50 transition-all cursor-pointer group text-center">
                <Upload className="w-8 h-8 text-zinc-400 group-hover:text-amber-400 transition-colors mb-2" />
                <span className="text-sm text-zinc-200 font-medium">
                  คลิกเพื่อเลือกไฟล์ หรือลากรูปภาพมาวางที่นี่
                </span>
                <span className="text-xs text-zinc-500 mt-1">
                  รองรับ PNG, JPG ขนาดไม่เกิน 2 MB (แนะนำอัตราส่วน 4:3)
                </span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      setImageUrl(url);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* Card 2: Price and Delivery Mode */}
          <div className="p-6 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-5 shadow-sm">
            <h2 className="text-lg font-bold text-white">ราคาและการส่งมอบ</h2>

            {/* 3 Price Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor={priceId} className="block text-sm font-medium text-zinc-200">
                  ราคาขาย (฿) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">
                    ฿
                  </span>
                  <input
                    id={priceId}
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="349.00"
                    className="w-full h-11 pl-8 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-white font-mono text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor={origPriceId}
                  className="block text-sm font-medium text-zinc-400"
                >
                  ราคาเดิม (฿)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">
                    ฿
                  </span>
                  <input
                    id={origPriceId}
                    type="number"
                    min="0"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="490.00"
                    className="w-full h-11 pl-8 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-sm focus:outline-none focus:border-zinc-700 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor={costPriceId} className="block text-sm font-medium text-zinc-400">
                  ต้นทุน (ดูเฉพาะแอดมิน)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 font-mono">
                    ฿
                  </span>
                  <input
                    id={costPriceId}
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    placeholder="150.00"
                    className="w-full h-11 pl-8 pr-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-300 font-mono text-sm focus:outline-none focus:border-zinc-700 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Methods (Select Buttons) */}
            <div className="space-y-2">
              <span className="block text-sm font-medium text-zinc-200">วิธีส่งมอบสินค้า</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setDeliveryMethod("AUTO_DISPATCH")}
                  aria-pressed={deliveryMethod === "AUTO_DISPATCH"}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    deliveryMethod === "AUTO_DISPATCH"
                      ? "bg-amber-500/10 border-amber-500 text-white shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">
                      ส่งรหัสอัตโนมัติ
                    </span>
                    {deliveryMethod === "AUTO_DISPATCH" && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    ลูกค้าได้รับข้อมูลไอดีและรหัสผ่านทันทีในหน้าจอหลังชำระเงินสำเร็จ
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setDeliveryMethod("ADMIN_MANUAL")}
                  aria-pressed={deliveryMethod === "ADMIN_MANUAL"}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer ${
                    deliveryMethod === "ADMIN_MANUAL"
                      ? "bg-amber-500/10 border-amber-500 text-white shadow-sm"
                      : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-bold text-white">
                      แอดมินส่งให้เอง
                    </span>
                    {deliveryMethod === "ADMIN_MANUAL" && (
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-400">
                    ลูกค้าส่งเลขออเดอร์ในแชท แอดมินตรวจสอบความถูกต้องแล้วส่งมอบให้
                  </p>
                </button>
              </div>
            </div>

            {/* Warranty Period Dropdown */}
            <div className="space-y-1.5">
              <label htmlFor={warrantyId} className="block text-sm font-medium text-zinc-200">
                ระยะเวลารับประกันสินค้า
              </label>
              <select
                id={warrantyId}
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                className="w-full h-11 px-4 rounded-lg bg-zinc-950 border border-zinc-800 text-white text-sm focus:outline-none focus:border-amber-500 transition-all cursor-pointer"
              >
                <option value="ไม่มีประกัน">ไม่มีประกัน</option>
                <option value="24 ชั่วโมง">24 ชั่วโมง (มาตรฐาน)</option>
                <option value="7 วัน">7 วัน</option>
                <option value="30 วัน">30 วัน</option>
              </select>
            </div>
          </div>

          {/* Card 3: Stock Management (Changes according to Delivery Method) */}
          <div className="p-6 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-4 shadow-sm">
            <h2 className="text-lg font-bold text-white">สต็อกรหัสสินค้า</h2>

            {deliveryMethod === "AUTO_DISPATCH" ? (
              <div className="space-y-3">
                <label
                  htmlFor={stockAreaId}
                  className="block text-sm font-medium text-zinc-200"
                >
                  วางข้อมูลไอดี (1 รายการต่อ 1 บรรทัด) <span className="text-red-400">*</span>
                </label>
                <textarea
                  id={stockAreaId}
                  rows={8}
                  value={rawStock}
                  onChange={(e) => setRawStock(e.target.value)}
                  placeholder={`username01:pass123\nusername02:pass456\nusername03:pass789`}
                  className="w-full p-4 rounded-lg bg-zinc-950 border border-zinc-800 text-zinc-100 font-mono text-xs leading-relaxed resize-y focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
                />

                {/* Stock Counter Badge */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-zinc-950 text-amber-400 border border-amber-500/30">
                    พบ {uniqueStockLines.length} รายการที่พร้อมบันทึก
                  </span>

                  <span className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-400" />
                    <span>ข้อมูลจะถูกเข้ารหัส AES-256 ก่อนเก็บในระบบ</span>
                  </span>
                </div>

                {/* Duplicate lines warning */}
                {duplicateCount > 0 && (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      มีรายการซ้ำ {duplicateCount} บรรทัด ระบบจะตัดบรรทัดที่ซ้ำออกโดยอัตโนมัติเมื่อบันทึก
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-5 rounded-lg bg-zinc-950 border border-zinc-800 space-y-2">
                <p className="text-sm text-white font-medium">
                  ไม่ต้องใช้สต็อกรหัสในระบบ
                </p>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  เนื่องจากเลือกวิธีส่งมอบแบบ "แอดมินส่งให้เอง" หน้าร้านจะแสดงป้ายกำกับว่า{" "}
                  <strong className="text-amber-400">"ส่งโดยแอดมิน"</strong>{" "}
                  แทนจำนวนตัวเลขสต็อก และแอดมินจะสามารถจัดส่งไอดีให้ลูกค้าผ่านระบบแชทได้โดยตรง
                </p>
              </div>
            )}
          </div>

          {/* Switch: Publish Immediately */}
          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex items-center justify-between gap-4 shadow-sm">
            <div className="space-y-0.5">
              <span className="text-sm font-medium text-white block">
                เปิดขายทันทีหลังบันทึก
              </span>
              <span className="text-xs text-zinc-400 block">
                ปิดสวิตช์นี้หากต้องการบันทึกเป็นฉบับร่าง (Draft) เพื่อตรวจสอบก่อนวางจำหน่าย
              </span>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={publishImmediately}
              onClick={() => setPublishImmediately(!publishImmediately)}
              className={`w-14 h-8 rounded-full p-1 transition-colors cursor-pointer flex items-center ${
                publishImmediately ? "bg-amber-500" : "bg-zinc-800"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full bg-zinc-950 shadow-md transform transition-transform ${
                  publishImmediately ? "translate-x-6" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Form Action Footer Bar */}
          <div className="p-5 rounded-xl bg-zinc-900/70 border border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            {/* Live Readiness Telemetry */}
            <div className="text-xs font-mono">
              {isStep4Done ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 stroke-[2.5]" />
                  <span>พร้อมบันทึกแล้ว</span>
                </span>
              ) : (
                <span className="text-amber-400">
                  ยังต้องกรอก: {missingFields.join(", ")}
                </span>
              )}
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleRequestCancel}
                className="h-10 px-5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={() => handleSave(true)}
                className="h-10 px-5 rounded-lg border border-amber-500/50 text-amber-400 hover:bg-amber-500/10 text-xs font-medium transition-colors cursor-pointer"
              >
                บันทึกฉบับร่าง
              </button>

              <button
                type="button"
                disabled={!isStep4Done}
                onClick={() => handleSave(false)}
                className={`h-10 px-6 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
                  isStep4Done
                    ? "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                    : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                }`}
              >
                <span>บันทึกและเปิดขาย</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Sticky Live Storefront Preview */}
        <div className="lg:col-span-5 sticky top-6 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-mono font-bold text-amber-500 uppercase tracking-widest">
              LIVE PREVIEW // ตัวอย่างหน้าร้าน
            </span>
            <span className="text-xs text-zinc-500 font-mono">อัปเดตสดตามข้อมูลที่กรอก</span>
          </div>

          {/* Storefront Card Simulation */}
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden shadow-2xl">
            {/* Image Box 4:3 */}
            <div className="aspect-[4/3] bg-zinc-950 relative flex items-center justify-center border-b border-zinc-800">
              {imageUrl ? (
                <img
                  src={imageUrl}
                  alt={title || "ตัวอย่างสินค้า"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-zinc-600">
                  <ShoppingBag className="w-10 h-10 opacity-30 text-amber-500" />
                  <span className="text-xs">อัตราส่วน 4:3 (ยังไม่มีรูปภาพ)</span>
                </div>
              )}

              {/* Status Pill Badge inside image preview */}
              <div className="absolute top-3 right-3 flex items-center gap-1.5">
                {publishImmediately ? (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 backdrop-blur-sm">
                    พร้อมขาย
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-zinc-800/80 text-zinc-400 border border-zinc-700 backdrop-blur-sm">
                    ฉบับร่าง
                  </span>
                )}
              </div>

              {/* Category pill */}
              <div className="absolute top-3 left-3">
                <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-zinc-950/80 text-zinc-300 border border-zinc-800 backdrop-blur-sm">
                  {category}
                </span>
              </div>
            </div>

            {/* Content Details */}
            <div className="p-5 space-y-4">
              <div>
                <span className="text-xs font-mono text-amber-400 block mb-0.5">
                  {sku.trim() || "SKU-AUTO-GEN"}
                </span>
                <h3 className="text-base font-semibold text-white leading-snug">
                  {title.trim() || "ชื่อสินค้าของคุณ"}
                </h3>
              </div>

              {/* Price and Stock Row */}
              <div className="flex items-baseline justify-between pt-2 border-t border-zinc-800">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-amber-400 font-mono leading-none">
                    {numPrice > 0 ? formatBaht(numPrice) : "฿0.00"}
                  </span>
                  {originalPrice && parseFloat(originalPrice) > 0 && (
                    <span className="text-xs text-zinc-500 line-through font-mono">
                      {formatBaht(parseFloat(originalPrice))}
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-400">
                  {deliveryMethod === "ADMIN_MANUAL" ? (
                    <span className="text-amber-400 font-semibold">ส่งโดยแอดมิน</span>
                  ) : (
                    <span>
                      <strong className="text-white font-mono">{stockCount}</strong> ชิ้นในคลัง
                    </span>
                  )}
                </div>
              </div>

              {/* Guarantee info */}
              <div className="text-xs text-zinc-400 flex items-center justify-between">
                <span>การรับประกัน: {warranty}</span>
                <span className="text-emerald-400">ตรวจสอบความปลอดภัย 100%</span>
              </div>

              {/* Simulated Buy Button */}
              <button
                type="button"
                disabled
                className="w-full h-11 rounded-lg bg-zinc-800 text-zinc-400 font-semibold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
              >
                <span>ซื้อทันที</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
