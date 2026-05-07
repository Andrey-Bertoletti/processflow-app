import type { Lead } from "@/lib/pipeline";
import { Bot, Mail, Phone, UserRound } from "lucide-react";

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
    <div
      className={`group cursor-grab select-none rounded-xl bg-zinc-900/60 p-3.5
        transition-all duration-200
        hover:bg-zinc-800/70 hover:-translate-y-0.5
        active:cursor-grabbing active:scale-[0.98] active:opacity-80
        ${isDragging ? "rotate-1 scale-105 opacity-70 shadow-xl" : ""}
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
      {/* Header: Avatar + Name */}
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-[10px] font-medium text-zinc-400">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium leading-tight text-white">{lead.name}</h4>
          {lead.email && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-zinc-500">
              <Mail className="h-2.5 w-2.5 shrink-0" />
              {lead.email}
            </p>
          )}
        </div>
      </div>

      {/* Footer: Badges */}
      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-zinc-800/60 pt-2">
        {/* Intelligence Badge */}
        {(lead as any).lead_insights?.[0] && (
          <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium
            ${(lead as any).lead_insights[0].sentiment === 'hot' ? 'bg-red-500/10 text-red-400' : 
              (lead as any).lead_insights[0].sentiment === 'warm' ? 'bg-amber-500/10 text-amber-400' : 
              'bg-blue-500/10 text-blue-400'}`}>
            {(lead as any).lead_insights[0].score}%
          </span>
        )}

        {lead.phone && (
          <span className="flex items-center gap-1 rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-500">
            <Phone className="h-2.5 w-2.5" />
          </span>
        )}
        {lead.assigned_to && (
          <span className="flex items-center gap-1 rounded-md bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-500">
            <UserRound className="h-2.5 w-2.5" />
          </span>
        )}
        {lead.campaign_id && (
          <span className="ml-auto flex items-center gap-1 rounded-md bg-blue-500/8 px-1.5 py-0.5 text-[10px] text-blue-400/70">
            <Bot className="h-2.5 w-2.5" />
          </span>
        )}
      </div>
    </div>
  );
}
