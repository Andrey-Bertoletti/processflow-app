"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";

export default function RegisterForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleRegister = async () => {
    if (password !== confirmPassword) {
      alert("As senhas não correspondem");
      return;
    }

    if (password.length < 6) {
      alert("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert("Conta criada! Verifique seu email para confirmar.");
    router.push("/auth/login");
  };

  return (
    <Surface className="app-enter p-8">
      <div className="mb-6">
        <span className="app-pill mb-3">Criar acesso</span>
        <h1 className="text-2xl font-bold text-white">Criar Conta</h1>
        <p className="mt-2 text-sm text-slate-400">Cadastre-se para começar.</p>
      </div>

      <div className="space-y-4">
        <TextField
          label="Email"
          type="email"
          placeholder="voce@empresa.com"
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Senha"
          type="password"
          placeholder="Senha com 6+ caracteres"
          onChange={(e) => setPassword(e.target.value)}
        />
        <TextField
          label="Confirmar Senha"
          type="password"
          placeholder="Repita sua senha"
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        <Button onClick={handleRegister} className="w-full">
          Criar conta
        </Button>
      </div>

      <p className="mt-6 text-center text-slate-400">
        Já tem conta? <Link href="/auth/login" className="text-green-500 hover:underline">Entrar</Link>
      </p>
    </Surface>
  );
}