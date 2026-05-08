"use client";

import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Globe, 
  Users, 
  Building2, 
  Activity, 
  Zap, 
  BarChart3, 
  ArrowUpRight,
  Loader2
} from "lucide-react";
import Surface from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function SuperAdminPage() {
  const [stats, setStats] = useState({
    workspaces: 0,
    leads: 0,
    users: 0,
    messages: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGlobalStats();
  }, []);

  async function loadGlobalStats() {
    try {
      setLoading(true);
      // Busca contagens globais (ignora RLS se o usuário for o owner ou via RPC)
      const [ws, ld, usr, msg] = await Promise.all([
        supabase.from("workspaces").select("*", { count: "exact", head: true }),
        supabase.from("leads").select("*", { count: "exact", head: true }),
        supabase.from("workspace_users").select("*", { count: "exact", head: true }),
        supabase.from("messages").select("*", { count: "exact", head: true })
      ]);

      setStats({
        workspaces: ws.count || 0,
        leads: ld.count || 0,
        users: usr.count || 0,
        messages: msg.count || 0
      });
    } catch (error: any) {
      toast.error("Erro ao carregar dados globais");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 shadow-lg shadow-amber-500/5">
            <ShieldCheck size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Super Admin Dashboard</h1>
            <p className="text-slate-400">Controle Global da Infraestrutura ProcessFlow.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={loadGlobalStats} disabled={loading} className="gap-2 border-white/5 bg-white/5 hover:bg-white/10 text-white">
          {loading ? <Loader2 className="animate-spin" size={18} /> : <Activity size={18} />}
          Atualizar métricas
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Workspaces" value={stats.workspaces} icon={Building2} color="blue" />
        <StatCard title="Total de Leads" value={stats.leads} icon={Users} color="emerald" />
        <StatCard title="Membros" value={stats.users} icon={Zap} color="purple" />
        <StatCard title="Mensagens IA" value={stats.messages} icon={BarChart3} color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Surface className="lg:col-span-2 p-6 border-white/5 bg-slate-900/50">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Globe size={20} className="text-blue-400" />
            Atividade Global Recente
          </h3>
          <div className="space-y-4">
            <p className="text-slate-400 text-sm italic">Logs de processamento em tempo real (em breve)...</p>
            <div className="h-64 rounded-xl border border-dashed border-white/10 flex items-center justify-center">
              <p className="text-slate-600 text-xs uppercase tracking-widest">Aguardando Eventos de IA</p>
            </div>
          </div>
        </Surface>

        <Surface className="p-6 border-white/5 bg-slate-900/50">
          <h3 className="text-lg font-bold text-white mb-4">Ações Rápidas</h3>
          <div className="space-y-3">
            <QuickAction title="Limpar Cache Global" description="Força revalidação de todos os workers." />
            <QuickAction title="Broadcast de Sistema" description="Envia nota para todos os usuários." />
            <QuickAction title="Exportar Dados (Audit)" description="Gera dump CSV de todos os leads." />
          </div>
        </Surface>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colors: any = {
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    purple: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <Surface className={`p-6 border-white/5 bg-slate-900/50 group hover:scale-[1.02] transition-all`}>
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${colors[color]} border`}>
          <Icon size={24} />
        </div>
        <ArrowUpRight size={18} className="text-slate-600 group-hover:text-slate-300" />
      </div>
      <div className="mt-4">
        <h4 className="text-slate-400 text-sm font-medium">{title}</h4>
        <p className="text-3xl font-bold text-white mt-1">{value}</p>
      </div>
    </Surface>
  );
}

function QuickAction({ title, description }: any) {
  return (
    <button className="w-full text-left p-4 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 hover:border-white/10 transition-all group">
      <h5 className="text-sm font-bold text-slate-200 group-hover:text-white">{title}</h5>
      <p className="text-xs text-slate-500 mt-1">{description}</p>
    </button>
  );
}
