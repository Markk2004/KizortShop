"use client";

import React, { useState, useEffect } from "react";
import { AlertTriangle, ShieldAlert, Check, X } from "lucide-react";

export interface HardConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  targetItemName?: string;
  expectedKeyword?: string; // If provided, user must type this exact keyword to unlock
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "amber";
  onConfirm: () => void;
  onCancel: () => void;
}

export function HardConfirmModal({
  isOpen,
  title,
  description,
  targetItemName,
  expectedKeyword = "CONFIRM",
  confirmLabel = "ยืนยันการทำรายการ",
  cancelLabel = "ยกเลิก",
  variant = "danger",
  onConfirm,
  onCancel,
}: HardConfirmModalProps) {
  const [typedInput, setTypedInput] = useState("");
  const [hasAcknowledged, setHasAcknowledged] = useState(false);

  // Reset inputs when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      setTypedInput("");
      setHasAcknowledged(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Step 1: Checkbox acknowledgment
  // Step 2: Keyword match verification (case-insensitive or exact)
  const isKeywordMatched = typedInput.trim().toUpperCase() === expectedKeyword.toUpperCase();
  const isUnlocked = hasAcknowledged && isKeywordMatched;

  const colorStyles = {
    danger: {
      border: "border-red-500/40",
      iconBg: "bg-red-500/10 text-red-400 border-red-500/30",
      buttonBg: "bg-red-600 hover:bg-red-500 text-white",
      badgeBg: "bg-red-500/10 text-red-400 border-red-500/30",
      keywordBg: "bg-red-950/60 text-red-300 border-red-500/40",
    },
    warning: {
      border: "border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      buttonBg: "bg-amber-500 hover:bg-amber-400 text-zinc-950",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      keywordBg: "bg-amber-950/60 text-amber-300 border-amber-500/40",
    },
    amber: {
      border: "border-amber-500/40",
      iconBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      buttonBg: "bg-amber-500 hover:bg-amber-400 text-zinc-950",
      badgeBg: "bg-amber-500/10 text-amber-400 border-amber-500/30",
      keywordBg: "bg-amber-950/60 text-amber-300 border-amber-500/40",
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="hard-confirm-title"
    >
      <div
        className={`w-full max-w-lg rounded-2xl bg-zinc-950 border ${colorStyles.border} p-6 shadow-2xl shadow-black/90 space-y-5 animate-in zoom-in-95 duration-200`}
      >
        {/* Header with Security Badge */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center border shrink-0 ${colorStyles.iconBg}`}
            >
              <ShieldAlert className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
                SECURITY ACTION // 2-STEP HARD CONFIRMATION
              </span>
              <h2
                id="hard-confirm-title"
                className="text-lg font-bold text-white tracking-tight"
              >
                {title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description & Target Item */}
        <div className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-2">
          {targetItemName && (
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800 text-xs">
              <span className="text-zinc-400">รายการเป้าหมาย:</span>
              <span className="font-mono font-bold text-white px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800">
                {targetItemName}
              </span>
            </div>
          )}
          <p className="text-sm text-zinc-300 leading-relaxed">{description}</p>
        </div>

        {/* 2-Step Verification Box */}
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 space-y-4">
          {/* Step 1: Checkbox Acknowledgment */}
          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hasAcknowledged}
              onChange={(e) => setHasAcknowledged(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-amber-500 focus:ring-1 focus:ring-amber-500 cursor-pointer"
            />
            <div className="space-y-0.5 text-xs">
              <span className="font-bold text-white block">
                ขั้นที่ 1: รับทราบและเข้าใจผลกระทบของการดำเนินการ
              </span>
              <span className="text-zinc-400 leading-relaxed block">
                ฉันได้ตรวจสอบรายละเอียดแล้ว และต้องการดำเนินการนี้ด้วยสิทธิ์แอดมิน
              </span>
            </div>
          </label>

          {/* Step 2: Type Confirmation Keyword */}
          <div className="space-y-2 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white">
                ขั้นที่ 2: พิมพ์คำว่า{" "}
                <code
                  className={`px-1.5 py-0.5 rounded font-mono font-bold border ${colorStyles.keywordBg}`}
                >
                  {expectedKeyword}
                </code>{" "}
                เพื่อปลดล็อก
              </span>
              {isKeywordMatched && (
                <span className="text-emerald-400 flex items-center gap-1 font-mono text-[11px] font-bold">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>KEYWORD MATCHED</span>
                </span>
              )}
            </div>

            <input
              type="text"
              value={typedInput}
              onChange={(e) => setTypedInput(e.target.value)}
              placeholder={`พิมพ์ "${expectedKeyword}" ที่นี่เพื่อยืนยัน...`}
              disabled={!hasAcknowledged}
              className="w-full h-11 px-4 rounded-xl bg-zinc-950 border border-zinc-800 text-white font-mono text-sm placeholder-zinc-600 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 px-5 rounded-xl border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-sm font-semibold transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            disabled={!isUnlocked}
            onClick={onConfirm}
            className={`h-11 px-6 rounded-xl font-bold text-sm transition-all shadow-lg flex items-center gap-2 ${
              isUnlocked
                ? `${colorStyles.buttonBg} cursor-pointer hover:scale-[1.02] active:scale-[0.98]`
                : "bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-50"
            }`}
          >
            <AlertTriangle className="w-4 h-4 stroke-[2.2]" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
