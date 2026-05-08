"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Session, User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  workspaces: any[];
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeWorkspaceId");
    }
    return null;
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const handleSetActiveWorkspace = useCallback((id: string | null) => {
    setActiveWorkspaceIdState(id);
    if (typeof window === "undefined") return;
    if (id) {
      localStorage.setItem("activeWorkspaceId", id);
    } else {
      localStorage.removeItem("activeWorkspaceId");
    }
  }, []);

  const applyWorkspaces = useCallback(
    (wsData: any[] | null | undefined) => {
      const list = wsData || [];
      setWorkspaces(list);
      if (list.length === 0) {
        handleSetActiveWorkspace(null);
        return;
      }
      const currentId =
        typeof window !== "undefined" ? localStorage.getItem("activeWorkspaceId") : null;
      const isValid = list.some((w: any) => w.id === currentId);
      if (!currentId || !isValid) {
        handleSetActiveWorkspace(list[0].id);
      }
    },
    [handleSetActiveWorkspace]
  );

  const syncSession = useCallback(
    async (session: Session | null) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (!nextUser) {
        setWorkspaces([]);
        handleSetActiveWorkspace(null);
        return;
      }

      const { data: wsData, error } = await supabase.rpc("get_user_workspaces");
      if (error) {
        console.error("[AUTH_WORKSPACES_ERR]", error);
        setWorkspaces([]);
        return;
      }
      applyWorkspaces(wsData as any[]);
    },
    [applyWorkspaces, handleSetActiveWorkspace]
  );

  const refreshWorkspaces = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    await syncSession(sessionData.session);
  }, [syncSession]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (cancelled) return;
      await syncSession(sessionData.session);
      if (cancelled) return;
      setLoading(false);
    };

    void boot();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        await syncSession(session);
        setLoading(false);
      })();
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, [syncSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        workspaces,
        activeWorkspaceId,
        setActiveWorkspaceId: handleSetActiveWorkspace,
        workspaceId,
        setWorkspaceId,
        refreshWorkspaces,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("AuthContext error");
  return context;
};
