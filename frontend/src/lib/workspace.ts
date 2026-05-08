import { supabase } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/types/database.types";

export interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string | null;
}

/**
 * List all workspaces the user belongs to
 */
export async function fetchWorkspaces(): Promise<Workspace[]> {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .order("name");

  if (error) throw new Error(error.message);
  return data || [];
}

/**
 * Create a new workspace
 * Note: A trigger/function usually adds the owner as a member automatically
 */
export async function createWorkspace(name: string): Promise<Workspace> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required");

  const { data, error } = await supabase
    .from("workspaces")
    .insert([{ name, owner_id: user.id }])
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Update workspace name
 */
export async function updateWorkspace(id: string, name: string): Promise<Workspace> {
  const { data, error } = await supabase
    .from("workspaces")
    .update({ name })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Delete a workspace (CRITICAL: RLS should handle permissions)
 */
export async function deleteWorkspace(id: string): Promise<void> {
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

/**
 * Fetch members of a workspace
 */
export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase.rpc("get_workspace_members", {
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((member: any) => ({
    id: member.id,
    userId: member.user_id,
    role: member.role,
    email: member.email,
    displayName: member.display_name || member.email || member.user_id,
  }));
}
