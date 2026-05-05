"use client";

import { useState } from "react";
import type { Lead, StageWithLeads } from "@/lib/pipeline";
import LeadCard from "@/components/pipeline/LeadCard";
import Surface from "@/components/ui/Surface";
import { Users } from "lucide-react";

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
          ? "border-blue-400/60 bg-blue-500/5 shadow-[0_0_30px_rgba(59,130,246,0.12)]"
          : ""
        }
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="border-b border-slate-700/70 px-4 py-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">{stage.name}</h3>
          <span className="flex items-center gap-1.5 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-slate-700/50">
            <Users className="h-3 w-3 opacity-60" />
            {stage.leads.length}
          </span>
        </div>

        {/* Barra de progresso sutil */}
        {stage.leads.length > 0 && (
          <div className="mt-2 h-0.5 w-full rounded-full bg-slate-800">
            <div
              className="h-0.5 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${Math.min((stage.leads.length / 10) * 100, 100)}%` }}
            />
          </div>
        )}
      </header>

      <div
        className={`flex-1 space-y-2.5 overflow-y-auto p-3 transition-all duration-200 ${
          isDragOver ? "space-y-3" : ""
        }`}
      >
        {isDragOver && (
          <div className="rounded-lg border-2 border-dashed border-blue-400/50 bg-blue-500/5 py-4 text-center text-xs text-blue-300 animate-pulse">
            Soltar aqui
          </div>
        )}

        {stage.leads.length === 0 && !isDragOver ? (
          <div className="rounded-lg border border-dashed border-slate-700 px-3 py-8 text-center text-xs text-slate-500">
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
