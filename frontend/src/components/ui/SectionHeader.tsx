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
    <div className="flex items-end justify-between gap-4 pb-3 border-b border-zinc-800/80">
      <div>
        {eyebrow && (
          <div className="flex items-center gap-2 text-[10px] font-mono font-semibold text-zinc-400 uppercase tracking-widest mb-1">
            <span className="w-1.5 h-1.5 bg-white" />
            <span>KZ // {eyebrow}</span>
          </div>
        )}
        <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
      </div>
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="text-xs font-mono text-zinc-400 hover:text-white font-medium flex items-center gap-1.5 transition-colors shrink-0"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
