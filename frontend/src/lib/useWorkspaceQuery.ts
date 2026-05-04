import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";

/**
 * Hook customizado que garante que TODA query inclua workspace_id
 * Usa o workspace ativo do contexto
 */
export function useWorkspaceQuery() {
  const { activeWorkspaceId } = useAuth();

  if (!activeWorkspaceId) {
    throw new Error("Nenhum workspace ativo selecionado");
  }

  return {
    workspaceId: activeWorkspaceId,
    // Helper para adicionar filtro de workspace automaticamente
    addWorkspaceFilter: (query: any) => {
      return query.eq("workspace_id", activeWorkspaceId);
    },
  };
}

/**
 * Helper para garantir que dados criados sempre incluem workspace_id
 */
export function ensureWorkspaceId(data: any, workspaceId: string) {
  return {
    ...data,
    workspace_id: workspaceId,
  };
}
