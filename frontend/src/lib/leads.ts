import { supabase } from "@/lib/supabase/client";
import type { Lead, LeadFormPayload } from "@/types/database.types";
import { normalizePhone, validateLeadPayload } from "@/lib/lead-validation";
import { buildCustomFieldMetadata, isBlankCustomFieldValue, type LeadWithCustomFieldValues, type WorkspaceCustomField } from "@/lib/custom-fields";

export { normalizePhone, validateLeadPayload };

async function replaceLeadCustomFieldValues(
  leadId: string,
  customFieldValues: LeadFormPayload["customFieldValues"],
) {
  const values = Object.entries(customFieldValues || {}).filter(([, value]) => !isBlankCustomFieldValue(value));

  const deleteResult = await supabase.from("lead_custom_field_values").delete().eq("lead_id", leadId);
  if (deleteResult.error) {
    throw new Error(deleteResult.error.message);
  }

  if (values.length === 0) {
    return;
  }

  const insertResult = await supabase.from("lead_custom_field_values").insert(
    values.map(([customFieldId, value]) => ({
      lead_id: leadId,
      custom_field_id: customFieldId,
      value,
    })),
  );

  if (insertResult.error) {
    throw new Error(insertResult.error.message);
  }
}

async function fetchLeadWithRelations(leadId: string) {
  const { data, error } = await supabase
    .from("leads")
    .select("*, lead_custom_field_values(*, workspace_custom_fields(*))")
    .eq("id", leadId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as LeadWithCustomFieldValues;
}

export async function createLeadInWorkspace(params: {
  workspaceId: string;
  payload: LeadFormPayload;
}): Promise<LeadWithCustomFieldValues> {
  const { workspaceId, payload } = params;
  const metadata = buildCustomFieldMetadata(payload.customFieldValues);

  const { data, error } = await supabase
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: normalizePhone(payload.phone),
      stage_id: payload.stageId,
      assigned_to: payload.assignedTo,
      campaign_id: payload.campaignId,
      metadata,
    })
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await replaceLeadCustomFieldValues(data.id, payload.customFieldValues);

  return await fetchLeadWithRelations(data.id);
}

export async function updateLeadInWorkspace(params: {
  workspaceId: string;
  leadId: string;
  payload: LeadFormPayload;
  expectedUpdatedAt?: string | null;
}): Promise<LeadWithCustomFieldValues> {
  const { workspaceId, leadId, payload, expectedUpdatedAt } = params;
  const metadata = buildCustomFieldMetadata(payload.customFieldValues);

  let query = supabase
    .from("leads")
    .update({
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: normalizePhone(payload.phone),
      stage_id: payload.stageId,
      assigned_to: payload.assignedTo,
      campaign_id: payload.campaignId,
      metadata,
    })
    .eq("id", leadId)
    .eq("workspace_id", workspaceId);

  if (expectedUpdatedAt) {
    query = query.eq("updated_at", expectedUpdatedAt);
  }

  const { data, error } = await query.select("*").single();

  if (error) {
    throw new Error(error.message);
  }

  await replaceLeadCustomFieldValues(data.id, payload.customFieldValues);

  return await fetchLeadWithRelations(data.id);
}

export async function deleteLeadInWorkspace(params: { workspaceId: string; leadId: string }) {
  const { workspaceId, leadId } = params;

  const { error } = await supabase
    .from("leads")
    .delete()
    .eq("id", leadId)
    .eq("workspace_id", workspaceId);

  if (error) {
    throw new Error(error.message);
  }
}
