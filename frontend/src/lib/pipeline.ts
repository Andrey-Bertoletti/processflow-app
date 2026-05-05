import { supabase } from "@/lib/supabase/client";
import type { Lead, Stage, WorkspaceMember, LeadFormPayload } from "@/types/database.types";
export type { Lead, Stage, WorkspaceMember, LeadFormPayload };

export type StageWithLeads = Stage & {
  leads: Lead[];
};

export async function fetchPipelineData(workspaceId: string): Promise<StageWithLeads[]> {
  const { data: stages, error: stagesError } = await supabase
    .from("stages")
    .select("*, leads(*, lead_insights(*))")
    .eq("workspace_id", workspaceId)
    .order("order", { ascending: true })
    .order("created_at", { ascending: false, foreignTable: "leads" });

  if (stagesError) {
    throw new Error(stagesError.message);
  }

  return (stages || []).map((stage) => {
    const stageWithRelation = stage as Stage & { leads?: Lead[] | null };
    return {
      ...stageWithRelation,
      leads: stageWithRelation.leads || [],
    };
  });
}


// Placeholder para futura integração com dnd-kit.
export async function moveLeadToStagePlaceholder(params: {
  workspaceId: string;
  leadId: string;
  targetStageId: string;
}) {
  const { workspaceId, leadId, targetStageId } = params;

  const { error } = await supabase
    .from("leads")
    .update({ stage_id: targetStageId })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }
}
export const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  email: "E-mail",
  phone: "Telefone",
  assigned_to: "Responsável",
};

/**
 * Valida se um lead possui todos os campos obrigatórios para entrar em uma etapa.
 * Retorna a lista de nomes amigáveis dos campos que estão faltando.
 */
export function validateLeadMovement(lead: Lead, targetStage: Stage): string[] {
  type RequiredFieldRule = { field: keyof Lead; label?: string };

  const rules = Array.isArray(targetStage.required_fields)
    ? (targetStage.required_fields as RequiredFieldRule[])
    : [];

  if (rules.length === 0) return [];

  const missingFields: string[] = [];

  rules.forEach((rule) => {
    const value = lead[rule.field as keyof Lead];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(rule.label || rule.field);
    }
  });

  return missingFields;
}

