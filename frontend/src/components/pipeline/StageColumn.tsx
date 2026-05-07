"use client";

import { useState } from "react";
import type { Lead, StageWithLeads } from "@/lib/pipeline";
import LeadCard from "@/components/pipeline/LeadCard";
import Surface from "@/components/ui/Surface";

type StageColumnProps = {
  stage: StageWithLeads;
  onDropLead?: (leadId: string, targetStageId: string) => Promise<void>;
  onLeadClick?: (leadId: string) => void;
};

export default function StageColumn({
  stage,
  onDropLead,
  onLeadClick,
}: StageColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Só remove o highlight se saiu do container da coluna de fato
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const leadId = e.dataTransfer.getData("text/plain");
    if (leadId && onDropLead) {
      await onDropLead(leadId, stage.id);
    }
  };

  return (
    <Surface
      data-stage-id={stage.id}
      className={`flex h-full min-h-[520px] w-[300px] shrink-0 flex-col transition-all duration-200
        ${isDragOver
          ? "ring-1 ring-blue-500/40 bg-blue-500/[0.03]"
          : ""
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="border-b border-zinc-800/80 px-4 py-3.5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">{stage.name}</h3>
          <span className="flex items-center gap-1 rounded-md bg-zinc-800/80 px-2 py-0.5 text-xs font-medium text-zinc-400">
            {stage.leads.length}
          </span>
        </div>

        {/* Progress bar */}
        {stage.leads.length > 0 && (
          <div className="mt-2.5 h-[2px] w-full rounded-full bg-zinc-800/60">
            <div
              className="h-[2px] rounded-full bg-blue-500/60 transition-all duration-500"
              style={{ width: `${Math.min((stage.leads.length / 10) * 100, 100)}%` }}
            />
          </div>
        )}
      </header>

      <div
        className={`flex-1 space-y-2 overflow-y-auto p-3 transition-all duration-200 ${
          isDragOver ? "space-y-3" : ""
        }`}
      >
        {isDragOver && (
          <div className="rounded-xl border border-dashed border-blue-500/30 bg-blue-500/[0.03] py-4 text-center text-xs text-blue-400/70">
            Soltar aqui
          </div>
        )}

        {stage.leads.length === 0 && !isDragOver ? (
          <div className="rounded-xl px-3 py-10 text-center text-xs text-zinc-600">
            Sem leads nesta etapa
          </div>
        ) : (
          stage.leads.map((lead: Lead) => (
            <div
              key={lead.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", lead.id);
                e.dataTransfer.effectAllowed = "move";
              }}
            >
              <LeadCard lead={lead} onClick={onLeadClick} />
            </div>
          ))
        )}
      </div>
    </Surface>
  );
}
