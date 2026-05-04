"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";

interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string | null;
}

export default function Dashboard() {
  const { user, loading, activeWorkspaceId, setActiveWorkspaceId } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);

  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("*")
          .eq("owner_id", user.id);

        if (error) {
          console.error("Erro ao buscar workspaces:", error);
          return;
        }

        setWorkspaces(data || []);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <p className="text-white text-xl">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <p className="text-red-400">Não autorizado</p>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Surface className="app-enter p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="app-pill mb-3">Workspace Overview</span>
              <h1 className="text-4xl font-bold text-white">Dashboard</h1>
              <p className="mt-2 text-slate-400">Bem-vindo, {user.email}</p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Surface>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Surface className="p-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Seu Email</h3>
            <p className="mt-3 text-lg text-white">{user.email}</p>
          </Surface>
          <Surface className="p-6">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">ID do Usuário</h3>
            <p className="mt-3 break-all font-mono text-sm text-white">{user.id}</p>
          </Surface>
        </div>

        <Surface className="p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-white">Meus Workspaces</h2>
            <div className="flex items-center gap-2">
              {activeWorkspaceId && (
                <Button variant="secondary" onClick={() => router.push("/pipeline")}>
                  Abrir Funil
                </Button>
              )}
              <Button onClick={() => router.push("/auth/workspace/create")}>+ Novo Workspace</Button>
            </div>
          </div>

          {loadingWorkspaces ? (
            <p className="text-slate-400">Carregando workspaces...</p>
          ) : workspaces.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-slate-400">Você ainda não tem workspaces.</p>
              <Button onClick={() => router.push("/auth/workspace/create")}>Criar seu primeiro workspace</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace: Workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    // Redireciona para workspace (quando existir página de workspace)
                    // router.push(`/workspace/${workspace.id}`);
                  }}
                  className={`text-left p-6 transition ${
                    activeWorkspaceId === workspace.id
                      ? "app-card-strong ring-1 ring-blue-500/40"
                      : "app-card hover:border-blue-400/40"
                  }`}
                >
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {workspace.name}
                  </h3>
                  <p className="mb-4 text-sm text-slate-400">
                    ID: {workspace.id.substring(0, 8)}...
                  </p>
                  <p className="text-xs text-slate-500">
                    Criado em: {workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : "-"}
                  </p>
                  {activeWorkspaceId === workspace.id && (
                    <p className="mt-3 text-xs font-semibold text-blue-300">✓ Ativo</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </main>
  );
}