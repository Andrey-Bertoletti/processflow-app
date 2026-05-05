import type { Lead } from "@/lib/pipeline";
import Surface from "@/components/ui/Surface";
import { Bot, UserRound, Mail, Phone } from "lucide-react";

type LeadCardProps = {
  lead: Lead;
  isDragging?: boolean;
  onClick?: (leadId: string) => void;
};

export default function LeadCard({ lead, isDragging = false, onClick }: LeadCardProps) {
  const initials = lead.name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Surface
      className={`group cursor-grab select-none p-3 transition-all duration-200
        hover:border-blue-400/40 hover:-translate-y-0.5 hover:shadow-xl
        active:cursor-grabbing active:scale-[0.98] active:opacity-80
        ${isDragging ? "rotate-1 shadow-2xl opacity-80 scale-105 cursor-grabbing" : ""}
      `}
      onClick={() => onClick?.(lead.id)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(lead.id);
        }
      }}
    >
      {/* Header: Avatar + Nome */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500/30 to-indigo-600/30 text-[10px] font-bold text-blue-200 ring-1 ring-blue-500/20">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-white leading-tight">{lead.name}</h4>
          {lead.email && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-400">
              <Mail className="h-2.5 w-2.5 shrink-0" />
              {lead.email}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Badges & Insights */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-slate-700/60 pt-2">
        {/* Intelligence Badge (Phase 10) */}
        {(lead as any).lead_insights?.[0] && (
          <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1
            ${(lead as any).lead_insights[0].sentiment === 'hot' ? 'bg-rose-500/20 text-rose-300 ring-rose-500/40' : 
              (lead as any).lead_insights[0].sentiment === 'warm' ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40' : 
              'bg-blue-500/20 text-blue-300 ring-blue-500/40'}`}>
            {(lead as any).lead_insights[0].sentiment === 'hot' ? '🔥' : (lead as any).lead_insights[0].sentiment === 'warm' ? '⚡' : '❄️'}
            {(lead as any).lead_insights[0].score}%
          </span>
        )}

        {lead.phone && (
          <span className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700/50">
            <Phone className="h-2.5 w-2.5" />
            {lead.phone}
          </span>
        )}
        {lead.assigned_to && (
          <span className="flex items-center gap-1 rounded-full bg-slate-800/80 px-2 py-0.5 text-[10px] text-slate-400 ring-1 ring-slate-700/50">
            <UserRound className="h-2.5 w-2.5" />
            Atribuído
          </span>
        )}
        {lead.campaign_id && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-indigo-950/50 px-2 py-0.5 text-[10px] text-indigo-300 ring-1 ring-indigo-500/20">
            <Bot className="h-2.5 w-2.5" />
            IA
          </span>
        )}
      </div>
    </Surface>
  );
}
