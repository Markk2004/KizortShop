"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (options: {
    type?: ToastType;
    title: string;
    description?: string;
    duration?: number;
  }) => void;
  success: (title: string, description?: string) => void;
  warning: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({
      type = "info",
      title,
      description,
      duration = 4000,
    }: {
      type?: ToastType;
      title: string;
      description?: string;
      duration?: number;
    }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newToast: ToastItem = { id, type, title, description, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback(
    (title: string, description?: string) => {
      toast({ type: "success", title, description });
    },
    [toast]
  );

  const warning = useCallback(
    (title: string, description?: string) => {
      toast({ type: "warning", title, description });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, description?: string) => {
      toast({ type: "error", title, description });
    },
    [toast]
  );

  const info = useCallback(
    (title: string, description?: string) => {
      toast({ type: "info", title, description });
    },
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, warning, error, info, dismiss }}>
      {children}

      {/* Fixed Bottom-Right Toast Alert Container */}
      <div
        className="fixed bottom-6 right-6 z-50 flex flex-col-reverse gap-3 max-w-[420px] w-full pointer-events-none select-none sm:select-auto"
        role="region"
        aria-label="การแจ้งเตือนระบบ"
      >
        {toasts.map((t) => {
          const typeConfig = {
            success: {
              border: "border-emerald-500/40",
              bg: "bg-zinc-950/95",
              glow: "shadow-emerald-500/10",
              badge: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
              icon: CheckCircle2,
              iconColor: "text-emerald-400",
              indicator: "bg-emerald-400",
            },
            warning: {
              border: "border-amber-500/40",
              bg: "bg-zinc-950/95",
              glow: "shadow-amber-500/10",
              badge: "bg-amber-500/15 text-amber-400 border-amber-500/30",
              icon: AlertTriangle,
              iconColor: "text-amber-400",
              indicator: "bg-amber-400",
            },
            error: {
              border: "border-red-500/40",
              bg: "bg-zinc-950/95",
              glow: "shadow-red-500/10",
              badge: "bg-red-500/15 text-red-400 border-red-500/30",
              icon: AlertCircle,
              iconColor: "text-red-400",
              indicator: "bg-red-400",
            },
            info: {
              border: "border-blue-500/40",
              bg: "bg-zinc-950/95",
              glow: "shadow-blue-500/10",
              badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",
              icon: Info,
              iconColor: "text-blue-400",
              indicator: "bg-blue-400",
            },
          }[t.type];

          const IconComponent = typeConfig.icon;

          return (
            <div
              key={t.id}
              role="alert"
              className={`pointer-events-auto rounded-xl ${typeConfig.bg} border ${typeConfig.border} p-4 shadow-2xl ${typeConfig.glow} backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 fade-in duration-300 flex items-start justify-between gap-3 relative overflow-hidden`}
            >
              {/* Left Color Accent Bar */}
              <div
                className={`absolute left-0 top-0 bottom-0 w-1 ${typeConfig.indicator}`}
              />

              <div className="flex items-start gap-3 pl-1.5 flex-1 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 ${typeConfig.badge}`}
                >
                  <IconComponent className={`w-4 h-4 ${typeConfig.iconColor}`} />
                </div>

                <div className="space-y-0.5 flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white leading-snug break-words">
                    {t.title}
                  </h4>
                  {t.description && (
                    <p className="text-xs text-zinc-400 leading-relaxed break-words">
                      {t.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="w-7 h-7 rounded-md flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
                aria-label="ปิดการแจ้งเตือน"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
