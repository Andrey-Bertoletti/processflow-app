"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type State = {
  isAdmin: boolean;
  loading: boolean;
  error: Error | null;
};

export default function useWorkspaceAdmin(workspaceId: string | null, enabled = true): State {
  const [state, setState] = useState<State>(() => ({
    isAdmin: false,
    loading: Boolean(enabled && workspaceId),
    error: null,
  }));

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!enabled || !workspaceId) {
        setState({ isAdmin: false, loading: false, error: null });
        return;
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      const { data, error } = await supabase.rpc("is_workspace_admin", { p_workspace_id: workspaceId });

      if (cancelled) return;

      if (error) {
        setState({ isAdmin: false, loading: false, error });
        return;
      }

      setState({ isAdmin: Boolean(data), loading: false, error: null });
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [enabled, workspaceId]);

  return state;
}
