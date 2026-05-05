import type { StageWithLeads } from "@/lib/pipeline";
import StageColumn from "@/components/pipeline/StageColumn";

type KanbanBoardProps = {
  stages: StageWithLeads[];
  onDropLeadPlaceholder?: (leadId: string, targetStageId: string) => Promise<void>;
  onLeadClick?: (leadId: string) => void;
};

export default function KanbanBoard({
  stages,
  onDropLeadPlaceholder,
  onLeadClick,
}: KanbanBoardProps) {
  return (
    <div className="overflow-x-auto pb-6 scrollbar-thin">
      <div className="flex min-w-max gap-4 px-1 py-1">
        {stages.map((stage: StageWithLeads) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            onDropLead={onDropLeadPlaceholder}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
    </div>
  );
}
