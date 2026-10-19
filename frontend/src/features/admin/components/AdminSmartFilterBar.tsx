"use client";

import { AlertTriangle, CheckCircle2, Filter, Search, ShieldCheck, X } from "lucide-react";

export type SearchFieldMode =
  | "ALL"
  | "ORDER_ID"
  | "SKU_CODE"
  | "USERNAME"
  | "NUMBER_PRICE";

export interface SearchModeOption {
  id: SearchFieldMode;
  label: string;
  hint: string;
}

export interface SearchVerificationResult {
  isValid: boolean;
  detectedTypeLabel: string;
  message: string;
}

const DEFAULT_MODES: SearchModeOption[] = [
  { id: "ALL", label: "ทั้งหมด", hint: "พยัญชนะไทย/อังกฤษ, ตัวเลข, รหัส" },
  { id: "ORDER_ID", label: "รหัสออเดอร์ / อ้างอิง", hint: "เช่น KZ-99412 หรือ TP-8801" },
  { id: "SKU_CODE", label: "รหัสสินค้า / สต็อก", hint: "เช่น BF-V4 หรือ STK-BFV4" },
  { id: "USERNAME", label: "ชื่อผู้ซื้อ / สมาชิก", hint: "เช่น player_99 หรืออีเมล" },
  { id: "NUMBER_PRICE", label: "ตัวเลข / ราคา (฿)", hint: "เฉพาะตัวเลข เช่น 349 หรือ 1000" },
];

/**
 * Inspects and verifies user search input for valid Thai/English consonants, vowels, digits, and safe symbols.
 */
export function verifySearchInput(
  rawQuery: string,
  mode: SearchFieldMode,
): SearchVerificationResult {
  const q = rawQuery.trim();
  if (!q) {
    return {
      isValid: true,
      detectedTypeLabel: "READY",
      message: "พร้อมกรองข้อมูล — รองรับพยัญชนะไทย-อังกฤษ และตัวเลข",
    };
  }

  // Block dangerous SQL/script injection characters first
  const forbiddenChars = /[<>;'"`\\{}[\]|^~]/;
  if (forbiddenChars.test(q)) {
    return {
      isValid: false,
      detectedTypeLabel: "INVALID CHAR",
      message:
        "พบอักขระพิเศษที่ไม่อนุญาต (< > ; ' \" \\) กรุณาใช้เฉพาะพยัญชนะและตัวเลข",
    };
  }

  if (mode === "NUMBER_PRICE") {
    const isNumberOnly = /^\d+(\.\d{1,2})?$/.test(q);
    if (!isNumberOnly) {
      return {
        isValid: false,
        detectedTypeLabel: "NUMERIC ERROR",
        message: "โหมดตัวเลข/ราคา ต้องกรอกเฉพาะตัวเลข (0-9) เท่านั้น ห้ามมีพยัญชนะปน",
      };
    }
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED NUMBER",
      message: `ยืนยันตัวเลขถูกต้อง: ค้นหายอดเงินหรือจำนวน "${q}"`,
    };
  }

  if (mode === "ORDER_ID") {
    const isCodeFormat = /^[A-Za-z0-9_-]+$/.test(q);
    if (!isCodeFormat) {
      return {
        isValid: false,
        detectedTypeLabel: "ORDER CODE ERROR",
        message:
          "รหัสออเดอร์/อ้างอิง ต้องเป็นตัวอักษรภาษาอังกฤษ (A-Z) ตัวเลข (0-9) หรือขีด (-) เท่านั้น",
      };
    }
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED ORDER ID",
      message: `ยืนยันรหัสอ้างอิงถูกต้อง: "${q.toUpperCase()}"`,
    };
  }

  if (mode === "SKU_CODE") {
    const isSkuFormat = /^[A-Za-z0-9_:-]+$/.test(q);
    if (!isSkuFormat) {
      return {
        isValid: false,
        detectedTypeLabel: "SKU FORMAT ERROR",
        message:
          "รหัสสินค้า (SKU) / Serial ต้องเป็นภาษาอังกฤษ (A-Z) ตัวเลข (0-9) หรือขีด (-) เท่านั้น",
      };
    }
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED SKU / SERIAL",
      message: `ยืนยันรหัส SKU/สต็อกถูกต้อง: "${q.toUpperCase()}"`,
    };
  }

  if (mode === "USERNAME") {
    const isUserFormat = /^[@A-Za-z0-9_.-]+$/.test(q);
    if (!isUserFormat) {
      return {
        isValid: false,
        detectedTypeLabel: "USERNAME ERROR",
        message:
          "ชื่อผู้ใช้งาน/อีเมล ต้องประกอบด้วยตัวอักษรภาษาอังกฤษ ตัวเลข หรือ @ . _ - เท่านั้น",
      };
    }
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED USER",
      message: `ยืนยันรูปแบบชื่อผู้ใช้ถูกต้อง: "${q}"`,
    };
  }

  // ALL mode: Auto-classify whether input is Numeric, Alphanumeric Code, or Thai/English Text
  const isPureNumeric = /^\d+(\.\d+)?$/.test(q);
  const hasThai = /[\u0E00-\u0E7F]/.test(q);
  const hasEnglish = /[A-Za-z]/.test(q);
  const hasDigits = /\d/.test(q);

  if (isPureNumeric) {
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED NUMERIC",
      message: `ตรวจพบตัวเลขล้วน (${q}) — ค้นหาจากราคา, ยอดเงิน และรหัสที่มีตัวเลขนี้`,
    };
  }

  if (hasThai && hasDigits) {
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED THAI + NUM",
      message: "ยืนยันพยัญชนะไทยผสมตัวเลขถูกต้อง",
    };
  }

  if (hasThai) {
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED THAI TEXT",
      message: "ยืนยันพยัญชนะภาษาไทยถูกต้อง — ค้นหาจากชื่อสินค้าและรายละเอียด",
    };
  }

  if (hasEnglish && hasDigits) {
    return {
      isValid: true,
      detectedTypeLabel: "VERIFIED CODE (A-Z + 0-9)",
      message: "ยืนยันตัวอักษรภาษาอังกฤษผสมตัวเลข (รหัสออเดอร์ / SKU / Username) ถูกต้อง",
    };
  }

  return {
    isValid: true,
    detectedTypeLabel: "VERIFIED ALPHA",
    message: "ยืนยันตัวอักษรภาษาอังกฤษถูกต้อง",
  };
}

interface AdminSmartFilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchMode: SearchFieldMode;
  onSearchModeChange: (mode: SearchFieldMode) => void;
  placeholder?: string;
  modes?: SearchModeOption[];
  totalMatched?: number;
  totalAll?: number;
  children?: React.ReactNode; // Extra status/category filter pills
}

export function AdminSmartFilterBar({
  searchQuery,
  onSearchChange,
  searchMode,
  onSearchModeChange,
  placeholder = "พิมพ์ค้นหาด้วยพยัญชนะไทย-อังกฤษ, รหัส SKU, เลขออเดอร์ หรือตัวเลขราคา...",
  modes = DEFAULT_MODES,
  totalMatched,
  totalAll,
  children,
}: AdminSmartFilterBarProps) {
  const verification = verifySearchInput(searchQuery, searchMode);
  const activeModeObj = modes.find((m) => m.id === searchMode) || modes[0];

  return (
    <div className="rounded-xl bg-obsidian-900 border border-zinc-800 p-4 sm:p-5 space-y-4">
      {/* ROW 1: Search Mode Selector Pills + Result Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-mono uppercase tracking-wider text-zinc-400 flex items-center gap-1.5 mr-2">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span>โหมดคัดกรอง:</span>
          </span>

          {modes.map((m) => {
            const isSelected = searchMode === m.id;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSearchModeChange(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  isSelected
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "bg-zinc-950 text-zinc-300 hover:text-white border border-zinc-800"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>

        {typeof totalMatched === "number" && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-zinc-400">ผลลัพธ์ที่ตรงเงื่อนไข:</span>
            <span className="px-2.5 py-1 rounded bg-zinc-950 border border-zinc-700 text-white font-bold num-tabular">
              {totalMatched}{" "}
              {typeof totalAll === "number" ? `/ ${totalAll}` : ""} รายการ
            </span>
          </div>
        )}
      </div>

      {/* ROW 2: High-Visibility Search Input + Extra Status Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={`${placeholder} (${activeModeObj.hint})`}
            className={`w-full bg-zinc-950 border rounded-lg pl-10 pr-24 py-2.5 text-sm text-white placeholder-zinc-500 focus:outline-none transition-colors ${
              !verification.isValid
                ? "border-red-500/70 focus:border-red-400"
                : searchQuery.trim()
                  ? "border-emerald-500/50 focus:border-emerald-400"
                  : "border-zinc-700 focus:border-white"
            }`}
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>ล้าง</span>
            </button>
          )}
        </div>

        {/* Status / Category Filter Slot */}
        {children && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {children}
          </div>
        )}
      </div>

      {/* ROW 3: Live Input Verification Status Bar (พยัญชนะ / ตัวเลข Verifier) */}
      <div
        className={`px-3.5 py-2 rounded-lg border text-xs flex flex-wrap items-center justify-between gap-2 ${
          !verification.isValid
            ? "bg-red-950/30 border-red-500/40 text-red-300"
            : searchQuery.trim()
              ? "bg-emerald-950/25 border-emerald-500/30 text-emerald-300"
              : "bg-zinc-950/70 border-zinc-800/90 text-zinc-400"
        }`}
      >
        <div className="flex items-center gap-2">
          {!verification.isValid ? (
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          ) : searchQuery.trim() ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" />
          )}
          <span className="font-medium">{verification.message}</span>
        </div>

        <span
          className={`px-2 py-0.5 rounded font-mono text-[11px] font-bold ${
            !verification.isValid
              ? "bg-red-500/20 text-red-300"
              : searchQuery.trim()
                ? "bg-emerald-500/20 text-emerald-300"
                : "bg-zinc-800 text-zinc-300"
          }`}
        >
          {verification.detectedTypeLabel}
        </span>
      </div>
    </div>
  );
}
