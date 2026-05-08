"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import Surface from "@/components/ui/Surface";
import Button from "@/components/ui/Button";
import { Activity, AlertTriangle, CheckCircle2, Clock, RefreshCw, Zap } from "lucide-react";

type WorkspaceHealth = {
  snapshot_at: string;
  jobs_7d: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retried: number;
    avg_latency_ms: number;
  };
  usage_today: {
    jobs_processed: number;
    tokens_consumed: number;
    estimated_cost_usd: number;
  };
  quota: {
    daily_limit: number;
    monthly_limit: number;
    is_suspended: boolean;
    usage_pct: number;
  };
  dlq_total: number;
};

function MetricPill({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: React.ElementType;
  label: string;
  value: number | string;
  className: string;
}) {
  return (
    <Surface className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-white">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${className}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Surface>
  );
}

export default function AutomationPage() {
  const { activeWorkspaceId, workspaces } = useAuth();
  const [health, setHealth] = useState<WorkspaceHealth | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const workspaceName = useMemo(() => {
    const list = (workspaces || []) as Array<{ id: string; name: string }>;
    return list.find((w) => w.id === activeWorkspaceId)?.name ?? null;
  }, [activeWorkspaceId, workspaces]);

  const fetchHealth = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)("get_workspace_health", {
        p_workspace_id: activeWorkspaceId,
      });

      if (rpcError) throw rpcError;
      setHealth(data as WorkspaceHealth);
    } catch (err: any) {
      console.error("[WORKSPACE_HEALTH_ERR]", err);
      setError(err?.message || "Erro ao carregar status da automação.");
      setHealth(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!activeWorkspaceId) {
      setHealth(null);
      setError(null);
      return;
    }

    void fetchHealth();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const intervalId = setInterval(() => void fetchHealth(), 15000);
    return () => clearInterval(intervalId);
  }, [activeWorkspaceId]);

  const statusLabel = useMemo(() => {
    const jobs = health?.jobs_7d;
    if (!jobs) return "Status desconhecido";
    if (jobs.failed > 0) return "Falhas detectadas";
    if (jobs.pending > 0 || jobs.processing > 0) return "Fila ativa";
    return "Sem jobs recentes";
  }, [health]);

  if (!activeWorkspaceId) {
    return (
      <main className="app-shell min-h-screen px-4 py-10">
        <div className="mx-auto max-w-5xl space-y-6">
          <Surface className="p-8">
            <h1 className="text-xl font-bold text-white">Automação & Worker</h1>
            <p className="mt-2 text-sm text-slate-400">
              Selecione um workspace no <Link className="text-blue-400 hover:text-blue-300" href="/auth/dashboard">dashboard</Link> para
              visualizar o status da fila e da automação.
            </p>
          </Surface>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-5xl space-y-6">
        <Surface className="p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-300">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">Automação & Worker</h1>
                  <p className="mt-1 text-xs text-slate-400">
                    Workspace: <span className="font-medium text-white">{workspaceName ?? activeWorkspaceId.slice(0, 8) + "…"}</span>
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                {statusLabel}. Esta tela ajuda a entender se há jobs pendentes e se o worker está processando.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />}
                onClick={() => void fetchHealth()}
                disabled={isLoading}
              >
                Atualizar
              </Button>
              <Link href="/pipeline">
                <Button variant="ghost">Voltar ao funil</Button>
              </Link>
            </div>
          </div>
        </Surface>

        {error ? (
          <Surface className="p-6 border border-red-500/20 bg-red-500/10">
            <div className="flex items-start gap-2 text-red-200">
              <AlertTriangle className="h-5 w-5 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Erro ao carregar status</p>
                <p className="mt-1 text-xs text-red-200/70 break-words">{error}</p>
              </div>
            </div>
          </Surface>
        ) : null}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricPill
            icon={Clock}
            label="Pendentes (7d)"
            value={health?.jobs_7d.pending ?? "—"}
            className="bg-amber-500/10 text-amber-300"
          />
          <MetricPill
            icon={Zap}
            label="Processando (7d)"
            value={health?.jobs_7d.processing ?? "—"}
            className="bg-blue-500/10 text-blue-300"
          />
          <MetricPill
            icon={CheckCircle2}
            label="Concluídos (7d)"
            value={health?.jobs_7d.completed ?? "—"}
            className="bg-emerald-500/10 text-emerald-300"
          />
          <MetricPill
            icon={AlertTriangle}
            label="Falhos (7d)"
            value={health?.jobs_7d.failed ?? "—"}
            className="bg-red-500/10 text-red-300"
          />
        </div>

        <Surface className="p-6">
          <h2 className="text-sm font-semibold text-white">Como a automação funciona</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-400">
            <li>
              - Ao mover um lead para uma etapa com <span className="font-mono">auto_campaign_id</span>, o banco enfileira um job em{" "}
              <span className="font-mono">job_queue</span> e cria uma mensagem placeholder com status{" "}
              <span className="font-mono">pending</span>.
            </li>
            <li>
              - O <span className="font-mono">ai-worker</span> processa essa fila em background e atualiza a mensagem para{" "}
              <span className="font-mono">generated</span> (ou <span className="font-mono">failed</span> se a tentativa exceder o limite).
            </li>
            <li>
              - Importante: o <span className="font-mono">ai-worker</span> depende de uma chamada recorrente (cron/scheduler/webhook)
              configurada no ambiente. Se não houver scheduler chamando o worker, os jobs ficam em{" "}
              <span className="font-mono">pending</span>.
            </li>
            <li>
              - Esta UI não exibe segredos. Caso exista <span className="font-mono">WEBHOOK_SECRET</span> no ambiente, ele deve ser
              configurado apenas no servidor/scheduler.
            </li>
          </ul>
        </Surface>
      </div>
    </main>
  );
}
