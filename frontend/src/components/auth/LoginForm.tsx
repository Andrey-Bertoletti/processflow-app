"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
      alert("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        alert(error.message);
        return;
      }

      // Verifica se o usuário já tem workspaces
      const { data: workspaces } = await supabase
        .from("workspaces")
        .select("id")
        .eq("owner_id", (await supabase.auth.getUser()).data.user?.id)
        .limit(1);

      if (workspaces && workspaces.length > 0) {
        router.push("/auth/dashboard");
      } else {
        router.push("/auth/workspace/create");
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <Surface className="app-enter p-8">
      <div className="mb-6">
        <span className="app-pill mb-3">Acesso Seguro</span>
        <h1 className="text-3xl font-bold text-white">Entrar</h1>
        <p className="mt-2 text-sm text-slate-400">Faça login para continuar.</p>
      </div>

      <div className="space-y-4">
        <TextField
          label="Email"
          type="email"
          placeholder="voce@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <TextField
          label="Senha"
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
        <Button onClick={handleLogin} disabled={loading} className="w-full">
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </div>

      <p className="mt-6 text-center text-slate-400">
        Não tem conta? {" "}
        <Link href="/auth/register" className="font-semibold text-blue-300 hover:text-blue-200">
          Registre-se aqui
        </Link>
      </p>
    </Surface>
  );
}