import type { Lead, Stage } from "../types/database.types";

export function groupLeadsByStage(stages: Stage[], leads: Lead[]) {
  return stages.map((stage: Stage) => ({
    ...stage,
    leads: leads.filter((lead: Lead) => lead.stage_id === stage.id),
  }));
}

export function getDefaultStageId(stages: Stage[]) {
  return [...stages].sort((a, b) => a.order - b.order)[0]?.id ?? null;
}
