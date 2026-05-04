import { supabase } from "@/lib/supabase";
import type { Lead, LeadFormPayload } from "@/lib/pipeline";
import { normalizePhone, validateLeadPayload } from "@/lib/lead-validation";

export { normalizePhone, validateLeadPayload };

export async function createLeadInWorkspace(params: {
  workspaceId: string;
  payload: LeadFormPayload;
}): Promise<Lead> {
  const { workspaceId, payload } = params;

  const { data, error } = await supabase
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: normalizePhone(payload.phone),
      stage_id: payload.stageId,
      assigned_to: payload.assignedTo,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateLeadInWorkspace(params: {
  workspaceId: string;
  leadId: string;
  payload: LeadFormPayload;
  expectedUpdatedAt?: string | null;
}): Promise<Lead> {
  const { workspaceId, leadId, payload, expectedUpdatedAt } = params;

  let query = supabase
    .from("leads")
    .update({
      name: payload.name.trim(),
      email: payload.email?.trim() || null,
      phone: normalizePhone(payload.phone),
      stage_id: payload.stageId,
      assigned_to: payload.assignedTo,
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

  return data;
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
