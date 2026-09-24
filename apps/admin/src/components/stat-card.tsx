"use client";

const ACCENT_STYLES: Record<string, { border: string; bg: string; text: string }> = {
  cobalt: { border: "border-l-cobalt", bg: "bg-cobalt/10", text: "text-cobalt" },
  online: { border: "border-l-online", bg: "bg-online/10", text: "text-online" },
  marker: { border: "border-l-marker", bg: "bg-marker/10", text: "text-marker" },
  highlighter: { border: "border-l-highlighter", bg: "bg-highlighter/10", text: "text-highlighter" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { value: number; positive: boolean };
  accent?: "cobalt" | "online" | "marker" | "highlighter";
}

export function StatCard({ title, value, subtitle, icon, trend, accent = "cobalt" }: StatCardProps) {
  const style = ACCENT_STYLES[accent];

  return (
    <div className={`group relative rounded-xl border border-ridge bg-ink p-5 border-l-[3px] ${style.border} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-faint uppercase font-semibold tracking-wider">{title}</p>
          <p className="text-2xl font-display font-bold text-paper mt-1.5 tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-dim mt-1 truncate">{subtitle}</p>}
          {trend && (
            <p className={`text-xs font-medium mt-1 ${trend.positive ? "text-online" : "text-marker"}`}>
              {trend.positive ? "+" : ""}{trend.value}%
            </p>
          )}
        </div>
        {icon && (
          <div className={`p-2 rounded-lg ${style.bg} ${style.text} shrink-0`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
