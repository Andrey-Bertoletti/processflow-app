import type { StageWithLeads } from "@/lib/pipeline";
import LeadCard from "@/components/pipeline/LeadCard";
import Surface from "@/components/ui/Surface";

type StageColumnProps = {
  stage: StageWithLeads;
  onDropLeadPlaceholder?: (leadId: string, targetStageId: string) => Promise<void>;
  onLeadClick?: (leadId: string) => void;
};

export default function StageColumn({
  stage,
  onDropLeadPlaceholder,
  onLeadClick,
}: StageColumnProps) {
  return (
    <Surface
      data-stage-id={stage.id}
      className="flex h-full min-h-[520px] w-[300px] shrink-0 flex-col"
    >
      <header className="border-b border-slate-700/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-white">{stage.name}</h3>
          <span className="app-pill">
            {stage.leads.length}
          </span>
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-3">
        {stage.leads.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-xs text-slate-500">
            Nenhum lead neste estagio
          </div>
        ) : (
          stage.leads.map((lead) => <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />)
        )}
      </div>

      {onDropLeadPlaceholder && (
        <footer className="border-t border-slate-700/70 px-3 py-2 text-[11px] text-slate-500">
          Estrutura pronta para onDrop (dnd-kit)
        </footer>
      )}
    </Surface>
  );
}
