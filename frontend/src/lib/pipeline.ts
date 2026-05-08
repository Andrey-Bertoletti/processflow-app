import { supabase } from "@/lib/supabase/client";
import type { Lead, Stage, WorkspaceMember, LeadFormPayload } from "@/types/database.types";
import {
  buildCustomFieldValueMap,
  getRequiredRuleLabel,
  isBlankCustomFieldValue,
  normalizeRequiredFieldRules,
  type LeadWithCustomFieldValues,
  type WorkspaceCustomField,
} from "@/lib/custom-fields";
export type { Lead, Stage, WorkspaceMember, LeadFormPayload };

export type StageWithLeads = Stage & {
  leads: LeadWithCustomFieldValues[];
};

/** Embedded columns for Kanban + validação de transição (sem messages/events em massa). */
const PIPELINE_LEADS_SELECT = `
  id,
  workspace_id,
  stage_id,
  name,
  email,
  phone,
  company,
  role,
  source,
  notes,
  assigned_to,
  campaign_id,
  metadata,
  created_at,
  updated_at,
  lead_insights(sentiment, score),
  lead_custom_field_values(
    id,
    workspace_id,
    lead_id,
    custom_field_id,
    value,
    created_at,
    updated_at,
    workspace_custom_fields(
      id,
      name,
      key,
      field_type,
      required,
      options,
      is_active
    )
  )
`.replace(/\s+/g, " ");

export async function fetchPipelineData(workspaceId: string): Promise<StageWithLeads[]> {
  const { data: stages, error: stagesError } = await supabase
    .from("stages")
    .select(`*, leads(${PIPELINE_LEADS_SELECT})`)
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
  company: "Empresa",
  role: "Cargo",
  source: "Origem",
  notes: "Observações",
};

/**
 * Valida se um lead possui todos os campos obrigatórios para entrar em uma etapa.
 * Retorna a lista de nomes amigáveis dos campos que estão faltando.
 */
export function validateLeadMovement(
  lead: LeadWithCustomFieldValues,
  targetStage: Stage,
  customFields: WorkspaceCustomField[] = [],
): string[] {
  const rules = normalizeRequiredFieldRules(targetStage.required_fields);

  if (rules.length === 0) return [];

  const missingFields: string[] = [];
  const customFieldValueMap = buildCustomFieldValueMap(lead.lead_custom_field_values);

  rules.forEach((rule) => {
    if (rule.custom_field_id) {
      const customField = customFields.find((field) => field.id === rule.custom_field_id);
      const fallbackValue = (lead.metadata as Record<string, unknown> | undefined)?.[rule.custom_field_id];
      const value = customFieldValueMap[rule.custom_field_id] ?? fallbackValue;

      if (isBlankCustomFieldValue(value)) {
        missingFields.push(getRequiredRuleLabel(rule, customFields));
      }
      return;
    }

    const fieldName = rule.field as keyof Lead;
    const value = lead[fieldName];
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(rule.label || rule.field || FIELD_LABELS[String(fieldName)] || String(fieldName));
    }
  });

  return missingFields;
}
