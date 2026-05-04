"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateWorkspace() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      alert("Digite um nome para o workspace");
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        alert("Usuário não autenticado");
        return;
      }

      // 1. Criar workspace
      const { data: workspace, error: workspaceError } = await supabase
        .from("workspaces")
        .insert({
          name,
          owner_id: user.id,
        })
        .select();

      if (workspaceError) {
        console.error("Erro ao criar workspace:", workspaceError);
        alert(workspaceError.message);
        return;
      }

      if (!workspace || workspace.length === 0) {
        alert("Erro ao criar workspace");
        return;
      }

      const workspaceId = workspace[0].id;

      // 2. Criar vínculo
      const { error: linkError } = await supabase.from("workspace_users").insert({
        workspace_id: workspaceId,
        user_id: user.id,
        role: "owner",
      });

      if (linkError) {
        console.error("Erro ao criar vínculo:", linkError);
        alert(linkError.message);
        return;
      }

      alert("Workspace criado com sucesso!");
      router.push("/auth/dashboard");
    } catch (error) {
      console.error("Erro:", error);
      alert("Erro ao criar workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg w-96">
        <h1 className="text-3xl font-bold text-white mb-2">Criar Workspace</h1>
        <p className="text-gray-400 mb-6">Comece criando seu primeiro workspace</p>
        
        <input
          className="w-full p-3 bg-gray-700 text-white rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Nome do workspace"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
        />
        
        <button
          onClick={handleCreate}
          disabled={loading}
          className="w-full bg-blue-600 text-white font-bold p-3 rounded hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {loading ? "Criando..." : "Criar Workspace"}
        </button>

        <div className="mt-6 text-center text-gray-400">
          <p>
            Não quer criar agora?{" "}
            <Link href="/auth/dashboard" className="text-blue-400 hover:underline">
              Ir para dashboard
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}