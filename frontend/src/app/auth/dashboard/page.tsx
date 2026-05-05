"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { Users, BarChart3, Activity, Briefcase } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

interface Workspace {
  id: string;
  name: string;
  owner_id: string | null;
  created_at: string | null;
}

interface DashboardMetrics {
  total_leads: number;
  total_campaigns: number;
  stage_distribution: {
    stage_id: string;
    stage_name: string;
    lead_count: number;
  }[];
  intelligence_distribution: {
    hot: number;
    warm: number;
    cold: number;
  };
}

export default function Dashboard() {
  const { user, loading, activeWorkspaceId, setActiveWorkspaceId } = useAuth();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchWorkspaces = async () => {
      try {
        const { data, error } = await supabase
          .from("workspaces")
          .select("*")
          .eq("owner_id", user.id);

        if (error) {
          console.error("Erro ao buscar workspaces:", error);
          return;
        }

        setWorkspaces(data || []);
      } finally {
        setLoadingWorkspaces(false);
      }
    };

    fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setMetrics(null);
      return;
    }

    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase as any).rpc('get_dashboard_metrics', { 
          p_workspace_id: activeWorkspaceId 
        });

        if (error) {
          console.error("Erro ao buscar métricas do dashboard:", error);
          return;
        }

        setMetrics(data as unknown as DashboardMetrics);
      } finally {
        setLoadingMetrics(false);
      }
    };

    fetchMetrics();
  }, [activeWorkspaceId]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  if (loading) {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <p className="text-white text-xl">Carregando...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-black">
        <p className="text-red-400">Não autorizado</p>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Surface className="app-enter p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <span className="app-pill mb-3">Workspace Overview</span>
              <h1 className="text-4xl font-bold text-white">Dashboard</h1>
              <p className="mt-2 text-slate-400">Bem-vindo, {user.email}</p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Sair
            </Button>
          </div>
        </Surface>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Surface className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-800">
                <Briefcase className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Usuário</h3>
                <p className="text-sm font-medium text-white">{user.email}</p>
              </div>
            </div>
          </Surface>
        </div>

        {/* Dashboard Métricas (Só aparece se houver workspace ativo) */}
        {activeWorkspaceId && (
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-indigo-500" />
              <h2 className="text-2xl font-bold text-white">Visão Executiva</h2>
            </div>
            
            {loadingMetrics ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-32 bg-slate-800 animate-pulse rounded-xl" />
                <div className="h-32 bg-slate-800 animate-pulse rounded-xl" />
              </div>
            ) : metrics ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* KPI Total Leads */}
                  <Surface className="p-6 border-l-4 border-l-blue-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Total de Leads</p>
                        <h3 className="text-4xl font-bold text-white mt-1">{metrics.total_leads}</h3>
                      </div>
                      <div className="p-3 bg-blue-500/10 rounded-lg">
                        <Users className="w-6 h-6 text-blue-500" />
                      </div>
                    </div>
                  </Surface>

                  {/* KPI Campanhas Ativas */}
                  <Surface className="p-6 border-l-4 border-l-emerald-500">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium text-slate-400">Campanhas Ativas</p>
                        <h3 className="text-4xl font-bold text-white mt-1">{metrics.total_campaigns}</h3>
                      </div>
                      <div className="p-3 bg-emerald-500/10 rounded-lg">
                        <Activity className="w-6 h-6 text-emerald-500" />
                      </div>
                    </div>
                  </Surface>
                </div>

                {/* Intelligence Funnel (Phase 10) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Surface className="p-5 ring-1 ring-rose-500/20 bg-gradient-to-br from-rose-500/5 to-transparent">
                    <p className="text-xs font-bold uppercase tracking-wider text-rose-400 mb-1">🔥 Hot Leads</p>
                    <p className="text-3xl font-black text-white">{metrics.intelligence_distribution?.hot ?? 0}</p>
                    <p className="text-[10px] text-slate-500 mt-2">Alta chance de conversão</p>
                  </Surface>
                  <Surface className="p-5 ring-1 ring-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">⚡ Warm Leads</p>
                    <p className="text-3xl font-black text-white">{metrics.intelligence_distribution?.warm ?? 0}</p>
                    <p className="text-[10px] text-slate-500 mt-2">Precisam de engajamento</p>
                  </Surface>
                  <Surface className="p-5 ring-1 ring-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <p className="text-xs font-bold uppercase tracking-wider text-blue-400 mb-1">❄️ Cold Leads</p>
                    <p className="text-3xl font-black text-white">{metrics.intelligence_distribution?.cold ?? 0}</p>
                    <p className="text-[10px] text-slate-500 mt-2">Baixo interesse no momento</p>
                  </Surface>
                </div>

                {/* Gráfico de Funil (Distribuição) */}
                <Surface className="p-6">
                  <h3 className="text-lg font-semibold text-white mb-6">Leads por Etapa do Funil</h3>
                  <div className="h-72 w-full">
                    {metrics.stage_distribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={metrics.stage_distribution}
                          margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                        >
                          <XAxis 
                            dataKey="stage_name" 
                            stroke="#64748b" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis 
                            stroke="#64748b" 
                            fontSize={12} 
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px', color: '#f8fafc' }}
                          />
                          <Bar dataKey="lead_count" radius={[6, 6, 0, 0]} maxBarSize={60}>
                            {metrics.stage_distribution.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === metrics.stage_distribution.length - 1 ? '#10b981' : '#6366f1'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-slate-500 border border-dashed border-slate-700 rounded-lg">
                        Nenhum lead encontrado neste funil.
                      </div>
                    )}
                  </div>
                </Surface>
              </>
            ) : null}
          </div>
        )}

        <Surface className="p-8">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-white">Meus Workspaces</h2>
            <div className="flex items-center gap-2">
              {activeWorkspaceId && (
                <Button variant="secondary" onClick={() => router.push("/pipeline")}>
                  Abrir Funil
                </Button>
              )}
              <Button onClick={() => router.push("/auth/workspace/create")}>+ Novo Workspace</Button>
            </div>
          </div>

          {loadingWorkspaces ? (
            <p className="text-slate-400">Carregando workspaces...</p>
          ) : workspaces.length === 0 ? (
            <div className="py-12 text-center">
              <p className="mb-4 text-slate-400">Você ainda não tem workspaces.</p>
              <Button onClick={() => router.push("/auth/workspace/create")}>Criar seu primeiro workspace</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace: Workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => {
                    setActiveWorkspaceId(workspace.id);
                    // Redireciona para workspace (quando existir página de workspace)
                    // router.push(`/workspace/${workspace.id}`);
                  }}
                  className={`text-left p-6 transition ${
                    activeWorkspaceId === workspace.id
                      ? "app-card-strong ring-1 ring-blue-500/40"
                      : "app-card hover:border-blue-400/40"
                  }`}
                >
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    {workspace.name}
                  </h3>
                  <p className="mb-4 text-sm text-slate-400">
                    ID: {workspace.id.substring(0, 8)}...
                  </p>
                  <p className="text-xs text-slate-500">
                    Criado em: {workspace.created_at ? new Date(workspace.created_at).toLocaleDateString() : "-"}
                  </p>
                  {activeWorkspaceId === workspace.id && (
                    <p className="mt-3 text-xs font-semibold text-blue-300">✓ Ativo</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </Surface>
      </div>
    </main>
  );
}