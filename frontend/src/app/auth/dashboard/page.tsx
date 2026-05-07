"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { Users, BarChart3, Activity, Briefcase, LogOut, ArrowRight, Shield } from "lucide-react";
import useWorkspaceAdmin from "@/hooks/useWorkspaceAdmin";
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

function MetricCard({ label, value, icon: Icon, accentClass = "text-blue-400 bg-blue-500/10" }: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  accentClass?: string;
}) {
  return (
    <Surface className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accentClass}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Surface>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-24 animate-pulse rounded-2xl bg-zinc-900" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
        <div className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, loading, activeWorkspaceId, setActiveWorkspaceId, workspaces: availableWorkspaces } = useAuth();
  const router = useRouter();
  const workspaces = (availableWorkspaces || []) as Workspace[];
  const loadingWorkspaces = loading;
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const { isAdmin } = useWorkspaceAdmin(activeWorkspaceId, Boolean(user && activeWorkspaceId));

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
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-5xl">
          <DashboardSkeleton />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-zinc-500">Não autorizado</p>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-8">

        {/* Header */}
        <div className="app-enter flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/15">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <span className="text-sm font-medium text-zinc-500">ProcessFlow</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Dashboard</h1>
            <p className="mt-1 text-sm text-zinc-500">Bem-vindo, {user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            {activeWorkspaceId ? (
              <Button variant="secondary" onClick={() => router.push("/pipeline")} leftIcon={<ArrowRight className="h-4 w-4" />}>
                Abrir Funil
              </Button>
            ) : null}
            {activeWorkspaceId && isAdmin ? (
              <Button variant="secondary" onClick={() => router.push("/admin")} leftIcon={<Shield className="h-4 w-4" />}>
                Admin
              </Button>
            ) : null}
            <Button variant="ghost" onClick={handleLogout} leftIcon={<LogOut className="h-4 w-4" />}>
              Sair
            </Button>
          </div>
        </div>

        {/* User Info */}
        <Surface className="app-enter p-5" style={{ animationDelay: "50ms" }}>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 text-sm font-medium text-zinc-400">
              {user.email?.[0]?.toUpperCase() ?? "U"}
            </div>
            <div>
              <p className="text-xs font-medium text-zinc-500">Conta</p>
              <p className="text-sm text-white">{user.email}</p>
            </div>
          </div>
        </Surface>

        {/* Metrics */}
        {activeWorkspaceId && (
          <div className="space-y-6 app-enter" style={{ animationDelay: "100ms" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Visão Executiva
            </h2>
            
            {loadingMetrics ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
                <div className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
              </div>
            ) : metrics ? (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <MetricCard label="Total de Leads" value={metrics.total_leads} icon={Users} />
                  <MetricCard
                    label="Campanhas Ativas"
                    value={metrics.total_campaigns}
                    icon={Activity}
                    accentClass="text-emerald-400 bg-emerald-500/10"
                  />
                </div>

                {/* Intelligence Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <Surface className="p-4 text-center">
                    <p className="text-xs font-medium text-zinc-500">Hot</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metrics.intelligence_distribution?.hot ?? 0}</p>
                  </Surface>
                  <Surface className="p-4 text-center">
                    <p className="text-xs font-medium text-zinc-500">Warm</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metrics.intelligence_distribution?.warm ?? 0}</p>
                  </Surface>
                  <Surface className="p-4 text-center">
                    <p className="text-xs font-medium text-zinc-500">Cold</p>
                    <p className="mt-1 text-2xl font-semibold text-white">{metrics.intelligence_distribution?.cold ?? 0}</p>
                  </Surface>
                </div>

                {/* Chart */}
                <Surface className="p-6">
                  <h3 className="mb-6 text-sm font-medium text-zinc-400">Leads por Etapa</h3>
                  <div className="h-64 w-full">
                    {metrics.stage_distribution.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={metrics.stage_distribution}
                          margin={{ top: 8, right: 8, left: -24, bottom: 16 }}
                        >
                          <XAxis 
                            dataKey="stage_name" 
                            stroke="#52525b" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                            angle={-15}
                            textAnchor="end"
                          />
                          <YAxis 
                            stroke="#52525b" 
                            fontSize={11} 
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                          />
                          <Tooltip 
                            cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                            contentStyle={{
                              backgroundColor: 'rgba(24, 24, 27, 0.96)',
                              border: '1px solid rgba(63, 63, 70, 0.5)',
                              borderRadius: '12px',
                              color: '#fafafa',
                              fontSize: '13px',
                              backdropFilter: 'blur(20px)',
                            }}
                          />
                          <Bar dataKey="lead_count" radius={[6, 6, 0, 0]} maxBarSize={48}>
                            {metrics.stage_distribution.map((_entry, index) => (
                              <Cell key={`cell-${index}`} fill={index === metrics.stage_distribution.length - 1 ? '#22c55e' : '#3b82f6'} fillOpacity={0.8} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-full items-center justify-center text-sm text-zinc-600">
                        Nenhum lead encontrado neste funil.
                      </div>
                    )}
                  </div>
                </Surface>
              </>
            ) : null}
          </div>
        )}

        {/* Workspaces */}
        <div className="app-enter" style={{ animationDelay: "150ms" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">Workspaces</h2>
            <div className="flex items-center gap-2">
              {activeWorkspaceId && (
                <Button variant="secondary" onClick={() => router.push("/pipeline")} leftIcon={<ArrowRight className="h-4 w-4" />}>
                  Abrir Funil
                </Button>
              )}
              <Button onClick={() => router.push("/auth/workspace/create")}>+ Novo</Button>
            </div>
          </div>

          {loadingWorkspaces ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
              ))}
            </div>
          ) : workspaces.length === 0 ? (
            <Surface className="py-16 text-center">
              <Briefcase className="mx-auto mb-3 h-8 w-8 text-zinc-600" />
              <p className="text-sm text-zinc-500">Nenhum workspace encontrado.</p>
              <Button className="mt-4" onClick={() => router.push("/auth/workspace/create")}>
                Criar seu primeiro workspace
              </Button>
            </Surface>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {workspaces.map((workspace: Workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => setActiveWorkspaceId(workspace.id)}
                  className={`group text-left p-5 rounded-2xl transition-all duration-200 ${
                    activeWorkspaceId === workspace.id
                      ? "app-card-strong ring-1 ring-blue-500/30"
                      : "app-card hover:ring-1 hover:ring-zinc-700"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-medium text-white">{workspace.name}</h3>
                      <p className="mt-1 text-xs text-zinc-600">
                        {workspace.created_at ? new Date(workspace.created_at).toLocaleDateString("pt-BR") : "—"}
                      </p>
                    </div>
                    {activeWorkspaceId === workspace.id && (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
