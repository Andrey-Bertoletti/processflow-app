import type { Lead } from "@/lib/pipeline";
import Surface from "@/components/ui/Surface";

type LeadCardProps = {
  lead: Lead;
  onClick?: (leadId: string) => void;
};

export default function LeadCard({ lead, onClick }: LeadCardProps) {
  return (
    <Surface
      className="cursor-pointer p-3 transition hover:border-blue-400/50"
      onClick={() => onClick?.(lead.id)}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(event) => {
        if (!onClick) {
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(lead.id);
        }
      }}
    >
      <h4 className="text-sm font-semibold text-white">{lead.name}</h4>

      {lead.email && <p className="mt-2 text-xs text-slate-300">{lead.email}</p>}
      {lead.phone && <p className="text-xs text-slate-400">{lead.phone}</p>}
    </Surface>
  );
}
