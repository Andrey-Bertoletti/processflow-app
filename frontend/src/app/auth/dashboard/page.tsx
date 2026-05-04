"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface Workspace {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
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
    <main className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      <div className="max-w-6xl mx-auto p-8">
        {/* Header */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-8 mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold text-white">Dashboard</h1>
              <p className="text-gray-400 mt-2">Bem-vindo, {user.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-6 py-3 rounded hover:bg-red-700 transition font-semibold"
            >
              Sair
            </button>
          </div>
        </div>

        {/* User Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-2">Seu Email</h3>
            <p className="text-gray-300">{user.email}</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-2">ID do Usuário</h3>
            <p className="text-gray-300 font-mono text-sm break-all">{user.id}</p>
          </div>
        </div>

        {/* Workspaces Section */}
        <div className="bg-gray-800 rounded-lg shadow-lg p-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Meus Workspaces</h2>
            <button
              onClick={() => router.push("/auth/workspace/create")}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition font-semibold"
            >
              + Novo Workspace
            </button>
          </div>

          {loadingWorkspaces ? (
            <p className="text-gray-400">Carregando workspaces...</p>
          ) : workspaces.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">Você ainda não tem workspaces</p>
              <button
                onClick={() => router.push("/auth/workspace/create")}
                className="bg-blue-600 text-white px-6 py-3 rounded hover:bg-blue-700 transition"
              >
                Criar seu primeiro workspace
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((workspace) => (
                <div
                  key={workspace.id}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    // Redireciona para workspace (quando existir página de workspace)
                    // router.push(`/workspace/${workspace.id}`);
                  }}
                  className={`p-6 rounded-lg cursor-pointer transition ${
                    activeWorkspaceId === workspace.id
                      ? "bg-blue-700 border-2 border-blue-400"
                      : "bg-gray-700 hover:bg-gray-600 border-2 border-transparent"
                  }`}
                >
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {workspace.name}
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    ID: {workspace.id.substring(0, 8)}...
                  </p>
                  <p className="text-gray-400 text-xs">
                    Criado em: {new Date(workspace.created_at).toLocaleDateString()}
                  </p>
                  {activeWorkspaceId === workspace.id && (
                    <p className="text-blue-200 text-xs mt-3 font-semibold">✓ Ativo</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}