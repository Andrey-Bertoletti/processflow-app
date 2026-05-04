import { supabase } from "@/lib/supabase";

export type WorkspaceMember = {
  id: string;
  userId: string;
  role: string | null;
  email: string | null;
  displayName: string;
};

export async function fetchWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const { data, error } = await supabase.rpc("get_workspace_members", {
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((member: WorkspaceMember) => ({
    ...member,
    displayName: member.displayName || member.email || member.userId,
  }));
}
