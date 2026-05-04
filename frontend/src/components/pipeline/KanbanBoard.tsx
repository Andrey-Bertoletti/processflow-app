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
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {stages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            onDropLeadPlaceholder={onDropLeadPlaceholder}
            onLeadClick={onLeadClick}
          />
        ))}
      </div>
    </div>
  );
}
