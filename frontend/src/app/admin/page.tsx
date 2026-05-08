"use client";

import Link from "next/link";
import Surface from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { Settings, Shield, Activity, ArrowRight, Zap, Building2, Crown } from "lucide-react";

export default function AdminHomePage() {
  return (
    <main className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-8">
        <Surface className="p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Admin</p>
              <h1 className="mt-2 text-2xl font-bold text-white">Painel Administrativo do Workspace</h1>
              <p className="mt-2 text-sm text-slate-400">
                Configurações que exigem perfil <span className="font-mono">admin</span>.
              </p>
            </div>
            <Link href="/pipeline">
              <Button variant="secondary" leftIcon={<ArrowRight className="h-4 w-4" />}>
                Voltar ao funil
              </Button>
            </Link>
          </div>
        </Surface>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300">
                <Zap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Automação & Worker</h2>
                <p className="text-xs text-slate-400">Jobs pendentes, processados e falhos.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/automation">
                <Button variant="secondary" className="w-full">
                  Abrir
                </Button>
              </Link>
            </div>
          </Surface>

          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Campos & Regras</h2>
                <p className="text-xs text-slate-400">Campos customizados e obrigatórios por etapa.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/settings/fields">
                <Button className="w-full">Abrir</Button>
              </Link>
            </div>
          </Surface>

          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-300">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Workspaces</h2>
                <p className="text-xs text-slate-400">Criar, editar e gerenciar espaços de trabalho.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/workspaces">
                <Button variant="secondary" className="w-full">
                  Abrir
                </Button>
              </Link>
            </div>
          </Surface>

          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-300">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Control Plane</h2>
                <p className="text-xs text-slate-400">Operações de worker/projeções (ambiente de dev).</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/control-plane">
                <Button variant="secondary" className="w-full">
                  Abrir
                </Button>
              </Link>
            </div>
          </Surface>

          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-300">
                <Activity className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">System Health</h2>
                <p className="text-xs text-slate-400">Observabilidade global (ops-only).</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/system-health">
                <Button variant="secondary" className="w-full">
                  Abrir
                </Button>
              </Link>
            </div>
          </Surface>

          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">Super Admin</h2>
                <p className="text-xs text-slate-400">Controle global e métricas da plataforma.</p>
              </div>
            </div>
            <div className="mt-4">
              <Link href="/admin/super">
                <Button variant="secondary" className="w-full">
                  Abrir
                </Button>
              </Link>
            </div>
          </Surface>
        </div>
      </div>
    </main>
  );
}
