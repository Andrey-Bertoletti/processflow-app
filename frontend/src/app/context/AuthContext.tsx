"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  workspaces: any[]; // Adicionado: lista de workspaces permitidos
  activeWorkspaceId: string | null;
  setActiveWorkspaceId: (id: string | null) => void;
  workspaceId: string | null;
  setWorkspaceId: (id: string) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]); // Lista de workspaces
  const [loading, setLoading] = useState(true);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeWorkspaceId");
    }
    return null;
  });
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Removido useEffect redundante que causava cascading renders


  // Salvar activeWorkspaceId no localStorage
  const handleSetActiveWorkspace = (id: string | null) => {
    setActiveWorkspaceId(id);
    if (id) {
      localStorage.setItem("activeWorkspaceId", id);
    } else {
      localStorage.removeItem("activeWorkspaceId");
    }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Carregar workspaces permitidos (Admin + Member)
        const { data: wsData } = await supabase.rpc("get_user_workspaces");
        setWorkspaces(wsData || []);

        // Se o activeWorkspaceId não estiver na lista (ou não existir), pega o primeiro
        if (wsData?.length > 0) {
          const currentId = localStorage.getItem("activeWorkspaceId");
          const isValid = wsData.some((w: any) => w.id === currentId);
          if (!currentId || !isValid) {
            handleSetActiveWorkspace(wsData[0].id);
          }
        }
      }
      
      setLoading(false);
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event: any, session: any) => {
        setUser(session?.user ?? null);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, loading, workspaces, activeWorkspaceId, setActiveWorkspaceId: handleSetActiveWorkspace, workspaceId, setWorkspaceId }}
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
