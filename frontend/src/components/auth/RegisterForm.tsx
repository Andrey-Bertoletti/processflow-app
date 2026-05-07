"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      toast.error("As senhas não correspondem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Conta criada com sucesso!");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface className="app-enter p-10">
      <div className="mb-8">
        <div className="mb-6 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">ProcessFlow</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">Criar Conta</h1>
        <p className="mt-1.5 text-sm text-zinc-500">Cadastre-se para começar a usar o sistema.</p>
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
          placeholder="Mínimo 6 caracteres"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />
        <TextField
          label="Confirmar Senha"
          type="password"
          placeholder="Repita sua senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          disabled={loading}
          autoComplete="new-password"
        />
        <Button onClick={handleRegister} disabled={loading} isLoading={loading} className="w-full" size="lg">
          {loading ? "Criando..." : "Criar conta"}
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-zinc-500">
        Já tem conta?{" "}
        <Link href="/auth/login" className="font-medium text-blue-400 transition-colors hover:text-blue-300">
          Entrar
        </Link>
      </p>
    </Surface>
  );
}