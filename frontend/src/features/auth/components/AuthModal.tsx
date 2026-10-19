"use client";

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Lock, Mail, ShieldCheck, User, X } from "lucide-react";
import { useAuth } from "../AuthContext";

export function AuthModal() {
  const { authModalOpen, authModalTab, openAuthModal, closeAuthModal, loginDemo } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && authModalOpen) {
        closeAuthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [authModalOpen, closeAuthModal]);

  if (!authModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginDemo();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={closeAuthModal}
    >
      <div
        className="relative w-full max-w-md bg-obsidian-950/95 border border-white/10 rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.95)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Close */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <img
              src="/assets/kaizort_logo_v4.jpeg"
              alt="KaiZort Logo"
              className="w-6 h-6 rounded-sm object-cover border border-zinc-700"
            />
            <h2 className="text-xs font-mono font-semibold tracking-wider text-white uppercase">
              KAIZORT // AUTHENTICATION
            </h2>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="p-5 pb-0">
          <div className="grid grid-cols-2 p-1 rounded-xl bg-obsidian-900 border border-white/[0.06]">
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authModalTab === "login"
                  ? "bg-white/[0.1] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              เข้าสู่ระบบ
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("register")}
              className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                authModalTab === "register"
                  ? "bg-white/[0.1] text-white shadow"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              สมัครสมาชิก
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {authModalTab === "login" ? (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  ชื่อผู้ใช้ หรือ อีเมล
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="เช่น user123 หรือ mail@example.com"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    รหัสผ่าน
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("ระบบกู้คืนรหัสผ่านจะเปิดให้บริการเร็วๆ นี้");
                    }}
                    className="text-[11px] text-blue-400 hover:underline"
                  >
                    ลืมรหัสผ่าน?
                  </a>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="รหัสผ่านของคุณ"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  ชื่อผู้ใช้
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ความยาว 4-16 ตัวอักษร"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  อีเมล
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mail@example.com"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="ความยาวอย่างน้อย 8 ตัวอักษร"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  ยืนยันรหัสผ่าน
                </label>
                <div className="relative">
                  <ShieldCheck className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านอีกครั้ง"
                    className="w-full bg-obsidian-900 border border-white/[0.08] focus:border-blue-500/50 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {/* Action Buttons */}
          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {authModalTab === "login" ? "เข้าสู่ระบบทันที" : "สร้างบัญชีใหม่"}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            {/* Quick Demo Login */}
            <button
              type="button"
              onClick={loginDemo}
              className="w-full py-2 px-3 rounded-xl text-[11px] font-medium text-slate-300 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>ทดลองเข้าสู่ระบบจำลอง (Demo Sal***)</span>
            </button>
          </div>
        </form>

        {/* Footer info */}
        <div className="p-4 bg-obsidian-900/50 border-t border-white/[0.05] text-center">
          <p className="text-[11px] text-slate-400">
            ระบบความปลอดภัยเข้ารหัส SSL 256-bit ปลอดภัยทุกการใช้งาน
          </p>
        </div>
      </div>
    </div>
  );
}
