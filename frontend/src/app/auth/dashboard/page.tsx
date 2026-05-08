"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { Users, BarChart3, Activity, Briefcase, LogOut, ArrowRight, Shield, TrendingUp, MessageSquare, PieChart, Send, Calendar, Zap } from "lucide-react";
import useWorkspaceAdmin from "@/hooks/useWorkspaceAdmin";
import { toast } from "sonner";
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, AreaChart, Area, CartesianGrid
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
  total_messages_sent: number;
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
  leads_30d: number;
  conversion_rate: number;
  messages_per_campaign: {
    campaign_name: string;
    message_count: number;
  }[];
  leads_over_time: {
    date: string;
    count: number;
  }[];
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
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const { isAdmin } = useWorkspaceAdmin(activeWorkspaceId, Boolean(user && activeWorkspaceId));
  const showAdvancedMetrics = Boolean(activeWorkspaceId && isAdmin);

  useEffect(() => {
    if (!activeWorkspaceId) {
      setMetrics(null);
      return;
    }

    const fetchMetrics = async () => {
      setLoadingMetrics(true);
      try {
        const { data, error } = await (supabase as any).rpc('get_dashboard_metrics', { 
          p_workspace_id: activeWorkspaceId 
        });

        if (error) {
          console.error("Erro ao buscar métricas do dashboard:", error);
          toast.error("Não foi possível carregar as métricas. Verifique sua conexão e tente recarregar.");
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
      <div className="mx-auto max-w-7xl space-y-8">

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
            {activeWorkspaceId ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="app-pill text-[11px]">
                  Perfil no workspace: <span className="font-mono">{isAdmin ? "admin" : "member"}</span>
                </span>
                {!isAdmin ? (
                  <span className="text-[11px] text-zinc-500">
                    Métricas avançadas ficam disponíveis para <span className="font-mono">admin</span>.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeWorkspaceId ? (
              <Button variant="secondary" onClick={() => router.push("/pipeline")} leftIcon={<ArrowRight className="h-4 w-4" />}>
                Abrir Funil
              </Button>
            ) : null}
            {activeWorkspaceId && isAdmin ? (
              <>
                <Button variant="secondary" onClick={() => router.push("/campaigns")} leftIcon={<Briefcase className="h-4 w-4" />}>
                  Campanhas
                </Button>
                <Button variant="secondary" onClick={() => router.push("/admin/pipeline")} leftIcon={<Activity className="h-4 w-4" />}>
                  Pipeline
                </Button>
                <Button variant="secondary" onClick={() => router.push("/admin/members")} leftIcon={<Users className="h-4 w-4" />}>
                  Membros
                </Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={handleLogout} leftIcon={<LogOut className="h-4 w-4" />}>
              Sair
            </Button>
          </div>
        </div>

        {/* Metrics */}
        {activeWorkspaceId && (
          <div className="space-y-6 app-enter" style={{ animationDelay: "100ms" }}>
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
              <BarChart3 className="h-4 w-4 text-zinc-500" />
              Visão Executiva
            </h2>
            
            {loadingMetrics ? (
              <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${showAdvancedMetrics ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
                {Array.from({ length: showAdvancedMetrics ? 4 : 2 }).map((_, i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl bg-zinc-900" />
                ))}
              </div>
            ) : metrics ? (
              <>
                <div className={`grid grid-cols-1 gap-4 md:grid-cols-2 ${showAdvancedMetrics ? "lg:grid-cols-4" : "lg:grid-cols-2"}`}>
                  <MetricCard label="Total de Leads" value={metrics.total_leads} icon={Users} />
                  <MetricCard
                    label="Mensagens Enviadas"
                    value={metrics.total_messages_sent}
                    icon={Send}
                    accentClass="text-emerald-400 bg-emerald-500/10"
                  />
                  {showAdvancedMetrics ? (
                    <>
                      <MetricCard 
                        label="Conversão Geral" 
                        value={`${metrics.conversion_rate}%`} 
                        icon={TrendingUp} 
                        accentClass="text-indigo-400 bg-indigo-500/10"
                      />
                      <MetricCard
                        label="Campanhas Ativas"
                        value={metrics.total_campaigns}
                        icon={Briefcase}
                        accentClass="text-amber-400 bg-amber-500/10"
                      />
                    </>
                  ) : null}
                </div>

                {showAdvancedMetrics ? (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Leads over time Chart */}
                    <Surface className="lg:col-span-2 p-6">
                      <h3 className="mb-6 text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Crescimento de Leads (Últimos 7 dias)
                      </h3>
                      <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={metrics.leads_over_time} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis 
                              dataKey="date" 
                              stroke="#52525b" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              tickFormatter={(str) => new Date(str).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis 
                              stroke="#52525b" 
                              fontSize={10} 
                              tickLine={false} 
                              axisLine={false}
                              allowDecimals={false}
                            />
                            <Tooltip 
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '8px', fontSize: '12px' }}
                              itemStyle={{ color: '#3b82f6' }}
                            />
                            <Area type="monotone" dataKey="count" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCount)" strokeWidth={2} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Surface>

                    {/* Intelligence Distribution */}
                    <Surface className="p-6">
                      <h3 className="mb-6 text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <Zap className="h-4 w-4" />
                        Temperatura dos Leads
                      </h3>
                      <div className="flex flex-col h-full justify-center space-y-6 pb-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                            <span className="text-sm text-zinc-300">Hot (Alta Intenção)</span>
                          </div>
                          <span className="text-lg font-bold text-white">{metrics.intelligence_distribution.hot}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                            <span className="text-sm text-zinc-300">Warm (Interessados)</span>
                          </div>
                          <span className="text-lg font-bold text-white">{metrics.intelligence_distribution.warm}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            <span className="text-sm text-zinc-300">Cold (Frios)</span>
                          </div>
                          <span className="text-lg font-bold text-white">{metrics.intelligence_distribution.cold}</span>
                        </div>
                        <div className="pt-4 border-t border-zinc-800">
                          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Resumo da Inteligência</p>
                          <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                            Baseado na análise semântica da IA sobre as últimas interações.
                          </p>
                        </div>
                      </div>
                    </Surface>
                  </div>
                ) : (
                  <Surface className="p-6 border border-white/5 bg-zinc-950/20">
                    <h3 className="text-sm font-medium text-white">Visão básica</h3>
                    <p className="mt-1 text-xs text-zinc-500">
                      Para manter a operação simples para <span className="font-mono">member</span>, este dashboard mostra apenas o essencial.
                      Um <span className="font-mono">admin</span> do workspace tem acesso a métricas avançadas.
                    </p>
                  </Surface>
                )}

                <div className={`grid grid-cols-1 ${showAdvancedMetrics ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
                  {/* Leads per Stage Chart */}
                  <Surface className="p-6">
                    <h3 className="mb-6 text-sm font-medium text-zinc-400 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Volume por Etapa do Funil
                    </h3>
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
                              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: '12px' }}
                            />
                            <Bar dataKey="lead_count" radius={[4, 4, 0, 0]} maxBarSize={40}>
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

                  {/* Messages per Campaign */}
                  {showAdvancedMetrics ? (
                    <Surface className="p-6">
                      <h3 className="mb-6 text-sm font-medium text-zinc-400 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Engajamento por Campanha (Mensagens Geradas)
                      </h3>
                      <div className="space-y-4">
                        {metrics.messages_per_campaign.length > 0 ? (
                          metrics.messages_per_campaign.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                              <div className="flex flex-col">
                                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">{item.campaign_name}</span>
                                <div className="mt-1.5 h-1.5 w-48 rounded-full bg-zinc-800 overflow-hidden">
                                  <div 
                                    className="h-full bg-blue-500/60 rounded-full" 
                                    style={{ width: `${Math.min((item.message_count / (metrics.total_messages_sent || 1)) * 100, 100)}%` }} 
                                  />
                                </div>
                              </div>
                              <span className="text-xs font-mono font-bold bg-zinc-800 px-2 py-1 rounded text-zinc-400 group-hover:text-blue-400">
                                {item.message_count}
                              </span>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-zinc-600 italic">Nenhuma mensagem gerada ainda.</p>
                        )}
                      </div>
                    </Surface>
                  ) : null}
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* Workspaces */}
        <div className="app-enter" style={{ animationDelay: "150ms" }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-white">Seus Workspaces</h2>
            <div className="flex items-center gap-2">
              <Button onClick={() => router.push("/auth/workspace/create")}>+ Novo Workspace</Button>
            </div>
          </div>

          {workspaces.length === 0 ? (
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
                      ? "app-card-strong ring-1 ring-blue-500/30 shadow-lg shadow-blue-500/5"
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
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm shadow-blue-500/20">
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
