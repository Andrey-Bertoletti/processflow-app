"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

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

      router.push("/auth/workspace/create");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-800 p-8 rounded-lg shadow-2xl">
      <h1 className="text-3xl font-bold text-white mb-2">Entrar</h1>
      <p className="text-gray-400 mb-6">Faça login para continuar</p>
      <input
        className="w-full p-3 bg-gray-700 text-white rounded mb-4 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        disabled={loading}
      />
      <input
        className="w-full p-3 bg-gray-700 text-white rounded mb-6 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
        type="password"
        placeholder="Senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        disabled={loading}
      />
      <button onClick={handleLogin} disabled={loading} className="w-full bg-green-600 text-white font-bold p-3 rounded hover:bg-green-700 disabled:opacity-50 transition">
        {loading ? "Entrando..." : "Entrar"}
      </button>
      <p className="text-center text-gray-400 mt-6">
        Não tem conta? {" "}
        <Link href="/auth/register" className="text-green-400 hover:underline font-semibold">
          Registre-se aqui
        </Link>
      </p>
    </div>
  );
}