"use client";

import Link from "next/link";
import Surface from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { AlertTriangle, ArrowRight, RefreshCw } from "lucide-react";

type Props = {
  mode: "development" | "production";
  title?: string;
  description?: string;
  details?: string;
};

export default function ConfigurationErrorScreen({
  mode,
  title = "Configuração necessária",
  description = "Este ambiente não está configurado para conectar ao Supabase.",
  details,
}: Props) {
  return (
    <main className="min-h-screen bg-[#05070d] px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-indigo-400/80" />
            <span className="text-xs font-semibold tracking-wide text-slate-400">ProcessFlow</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              leftIcon={<RefreshCw className="h-4 w-4" />}
            >
              Recarregar
            </Button>
            <Link href="/auth/login">
              <Button variant="ghost" leftIcon={<ArrowRight className="h-4 w-4" />}>
                Login
              </Button>
            </Link>
          </div>
        </div>

        <Surface className="relative overflow-hidden p-8">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-sky-500/10 blur-3xl" />

          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>

              {mode === "development" ? (
                <div className="mt-5 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Para desenvolvedores</p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs text-slate-200">
                    <p className="font-mono whitespace-pre-wrap">
                      Defina `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `frontend/.env.local`.
                    </p>
                    {details ? (
                      <p className="mt-3 font-mono whitespace-pre-wrap text-slate-400">{details}</p>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
                  Se você é usuário final, entre em contato com o administrador. Se você é o responsável pelo deploy,
                  verifique as variáveis de ambiente públicas do Frontend.
                </div>
              )}
            </div>
          </div>
        </Surface>

        <p className="mt-6 text-center text-xs text-slate-600">
          {mode === "development"
            ? "Este erro aparece apenas em desenvolvimento para acelerar o diagnóstico."
            : "Nenhum detalhe sensível foi exposto."}
        </p>
      </div>
    </main>
  );
}

