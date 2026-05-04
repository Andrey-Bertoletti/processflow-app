import type { Lead, Stage } from "@/lib/pipeline";

export function groupLeadsByStage(stages: Stage[], leads: Lead[]) {
  return stages.map((stage) => ({
    ...stage,
    leads: leads.filter((lead) => lead.stage_id === stage.id),
  }));
}

export function getDefaultStageId(stages: Stage[]) {
  return [...stages].sort((a, b) => a.order - b.order)[0]?.id ?? null;
}
