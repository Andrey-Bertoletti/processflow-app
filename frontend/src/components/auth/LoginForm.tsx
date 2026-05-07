"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error("Erro no Auth do Supabase:", error);
        toast.error(error.message);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado após login");

      // Verifica se o usuário já possui workspaces (admin ou member)
      const { data: workspaces, error: wsError } = await supabase.rpc("get_user_workspaces");

      if (wsError) {
        console.error("Erro ao buscar workspaces:", wsError);
        toast.error(`Erro de Banco: ${wsError.message}`);
        return;
      }

      if (Array.isArray(workspaces) && workspaces.length > 0) {
        router.push("/auth/dashboard");
      } else {
        router.push("/auth/workspace/create");
      }

    } catch (err: any) {
      console.error("Erro inesperado no login:", err);
      toast.error(err.message || "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface className="app-enter p-10">
      {/* Logo Area */}
      <div className="mb-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">ProcessFlow</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Bem-vindo de volta</h1>
        <p className="mt-1.5 text-sm text-zinc-500">Entre com suas credenciais para continuar.</p>
      </div>

      <div className="space-y-5">
        <TextField
          label="Email"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          autoComplete="email"
        />
        <TextField
          label="Senha"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="current-password"
        />
        <Button
          onClick={handleLogin}
          disabled={loading}
          isLoading={loading}
          className="w-full"
          size="lg"
        >
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Não tem conta?{" "}
        <Link href="/auth/register" className="font-medium text-blue-400 transition-colors hover:text-blue-300">
          Criar conta
        </Link>
      </p>
    </Surface>
  );
}
