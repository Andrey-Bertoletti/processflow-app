import { supabase } from "@/lib/supabase/client";
import type { WorkspaceMember } from "@/types/database.types";

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
