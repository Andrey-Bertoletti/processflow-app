"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";

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

      // 1. Criar workspace + membership via RPC segura
      const { data: workspaceId, error: createError } = await (supabase.rpc as any)(
        "create_workspace_with_owner",
        { p_name: name.trim() }
      );

      if (createError) {
        console.error("Erro ao criar workspace:", createError);
        alert(createError.message);
        return;
      }

      if (!workspaceId) {
        alert("Erro ao criar workspace");
        return;
      }

      // 2. Seed do pipeline (estagios padrao + leads demo)
      const { error: seedError } = await (supabase.rpc as any)("seed_workspace_pipeline", {
        p_workspace_id: workspaceId,
        p_with_demo_leads: true,
      });

      if (seedError) {
        console.error("Erro ao criar seed do pipeline:", seedError);
        alert(`Workspace criado, mas houve erro ao inicializar o funil: ${seedError.message}`);
        router.push("/auth/dashboard");
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
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Surface className="app-enter w-full max-w-lg p-8">
        <div className="mb-6">
          <span className="app-pill mb-3">Novo Espaço</span>
          <h1 className="text-3xl font-bold text-white">Criar Workspace</h1>
          <p className="mt-2 text-sm text-slate-400">Comece criando seu primeiro workspace.</p>
        </div>

        <div className="space-y-4">
          <TextField
            label="Nome do workspace"
            placeholder="Ex: Time Comercial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? "Criando..." : "Criar Workspace"}
          </Button>
        </div>

        <div className="mt-6 text-center text-sm text-slate-400">
          <p>
            Não quer criar agora?{" "}
            <Link href="/auth/dashboard" className="font-semibold text-blue-300 hover:text-blue-200">
              Ir para dashboard
            </Link>
          </p>
        </div>
      </Surface>
    </main>
  );
}