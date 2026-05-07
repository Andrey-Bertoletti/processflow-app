"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/app/context/AuthContext";
import Surface from "@/components/ui/Surface";
import Button from "@/components/ui/Button";

type Props = {
  children: ReactNode;
};

export default function RequireWorkspaceAdmin({ children }: Props) {
  const router = useRouter();
  const { user, loading, activeWorkspaceId } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const workspaceId = activeWorkspaceId || null;
  const workspaceLabel = useMemo(() => {
    if (!workspaceId) return "nenhum workspace selecionado";
    return workspaceId.slice(0, 8) + "…";
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (loading) return;

      if (!user) {
        setIsAdmin(false);
        return;
      }

      if (!workspaceId) {
        setIsAdmin(false);
        return;
      }

      const { data, error } = await supabase.rpc("is_workspace_admin", { p_workspace_id: workspaceId });

      if (cancelled) return;

      if (error) {
        console.error("[ADMIN_GUARD_ERROR]", error);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(Boolean(data));
    }

    setIsAdmin(null);
    void run();

    return () => {
      cancelled = true;
    };
  }, [loading, user, workspaceId]);

  if (loading || isAdmin === null) {
    return (
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Surface className="p-6">
            <p className="text-sm text-slate-400">Validando permissões de administração...</p>
          </Surface>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Surface className="p-6 space-y-4">
            <h1 className="text-lg font-bold text-white">Acesso restrito</h1>
            <p className="text-sm text-slate-400">Você precisa estar logado para acessar esta área.</p>
            <div className="flex gap-2">
              <Button onClick={() => router.replace("/auth/login")}>Ir para login</Button>
              <Button variant="secondary" onClick={() => router.replace("/pipeline")}>Voltar</Button>
            </div>
          </Surface>
        </div>
      </main>
    );
  }

  if (!workspaceId) {
    return (
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Surface className="p-6 space-y-4">
            <h1 className="text-lg font-bold text-white">Workspace não selecionado</h1>
            <p className="text-sm text-slate-400">Selecione um workspace para acessar as configurações administrativas.</p>
            <Button onClick={() => router.replace("/auth/dashboard")}>Abrir Dashboard</Button>
          </Surface>
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return (
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <Surface className="p-6 space-y-4">
            <h1 className="text-lg font-bold text-white">403 — Acesso negado</h1>
            <p className="text-sm text-slate-400">
              Esta área requer perfil <span className="font-mono">admin</span> no workspace{" "}
              <span className="font-mono">{workspaceLabel}</span>.
            </p>
            <Button variant="secondary" onClick={() => router.replace("/pipeline")}>Voltar ao funil</Button>
          </Surface>
        </div>
      </main>
    );
  }

  return <>{children}</>;
}
