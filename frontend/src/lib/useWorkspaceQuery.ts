import { useAuth } from "@/app/context/AuthContext";
import type { PostgrestFilterBuilder } from "@supabase/postgrest-js";

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addWorkspaceFilter: <T extends { eq: (col: string, val: any) => any }>(query: T): T => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return query.eq("workspace_id" as any, activeWorkspaceId);
    },

  };
}

/**
 * Helper para garantir que dados criados sempre incluem workspace_id
 */
export function ensureWorkspaceId<T extends Record<string, unknown>>(data: T, workspaceId: string): T & { workspace_id: string } {
  return {
    ...data,
    workspace_id: workspaceId,
  };
}

