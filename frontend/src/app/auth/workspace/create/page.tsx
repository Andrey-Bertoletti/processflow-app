"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";

export default function CreateWorkspace() {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Digite um nome para o workspace");
      return;
    }

    setLoading(true);

    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;

      if (!user) {
        toast.error("Usuário não autenticado");
        return;
      }

      // 1. Criar workspace + membership via RPC segura
      const { data: workspaceId, error: createError } = await supabase.rpc("create_workspace_with_owner", {
        p_name: name.trim(),
      });

      if (createError) {
        console.error("Erro ao criar workspace:", createError);
        toast.error(createError.message);
        return;
      }

      if (!workspaceId) {
        toast.error("Erro ao criar workspace");
        return;
      }

      // 2. Seed do pipeline (estagios padrao + leads demo)
      const { error: seedError } = await supabase.rpc("seed_workspace_pipeline", {
        p_workspace_id: workspaceId,
        p_with_demo_leads: true,
      });

      if (seedError) {
        console.error("Erro ao criar seed do pipeline:", seedError);
        toast.warning(`Workspace criado, mas houve erro ao inicializar o funil: ${seedError.message}`);
        router.push("/auth/dashboard");
        return;
      }

      toast.success("Workspace criado com sucesso!");
      router.push("/auth/dashboard");
    } catch (error: any) {
      console.error("Erro:", error);
      toast.error(error.message || "Erro ao criar workspace");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="app-shell flex min-h-screen items-center justify-center px-4 py-10">
      <Surface className="app-enter w-full max-w-lg p-10">
        <div className="mb-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
              </svg>
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">ProcessFlow</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Criar Workspace</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Comece criando seu espaço de trabalho.</p>
        </div>

        <div className="space-y-5">
          <TextField
            label="Nome do workspace"
            placeholder="Ex: Time Comercial"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
          />

          <Button onClick={handleCreate} disabled={loading} isLoading={loading} className="w-full" size="lg">
            {loading ? "Criando..." : "Criar Workspace"}
          </Button>
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Não quer criar agora?{" "}
          <Link href="/auth/dashboard" className="font-medium text-blue-400 transition-colors hover:text-blue-300">
            Ir para dashboard
          </Link>
        </p>
      </Surface>
    </main>
  );
}
