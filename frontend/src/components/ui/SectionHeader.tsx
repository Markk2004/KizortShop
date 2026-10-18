import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionHref?: string;
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  actionLabel,
  actionHref,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span>{eyebrow}</span>
          </div>
        )}
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors shrink-0"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}
