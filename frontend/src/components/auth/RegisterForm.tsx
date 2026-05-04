"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
    <div className="space-y-4 w-80">
      <h1 className="text-2xl font-bold text-white mb-6">Criar Conta</h1>
      <input
        className="w-full p-2 bg-gray-800 text-white rounded"
        placeholder="Email"
        type="email"
        onChange={(e) => setEmail(e.target.value)}
      />
      <input
        className="w-full p-2 bg-gray-800 text-white rounded"
        type="password"
        placeholder="Senha"
        onChange={(e) => setPassword(e.target.value)}
      />
      <input
        className="w-full p-2 bg-gray-800 text-white rounded"
        type="password"
        placeholder="Confirmar Senha"
        onChange={(e) => setConfirmPassword(e.target.value)}
      />
      <button onClick={handleRegister} className="bg-blue-500 p-2 w-full rounded font-semibold hover:bg-blue-600">
        Criar conta
      </button>
      <p className="text-center text-gray-400">
        Já tem conta? <Link href="/auth/login" className="text-green-500 hover:underline">Entrar</Link>
      </p>
    </div>
  );
}