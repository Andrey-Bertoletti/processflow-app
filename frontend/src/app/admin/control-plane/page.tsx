"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { 
  Activity, Server, Database, ShieldAlert, Zap, Layers, RefreshCw, AlertOctagon, Terminal
} from "lucide-react";

type SystemStats = {
  activeJobs: number;
  failedJobs: number;
  totalTokens: number;
  globalBackpressure: boolean;
};

export default function ControlPlanePage() {
  const [stats, setStats] = useState<SystemStats>({
    activeJobs: 0,
    failedJobs: 0,
    totalTokens: 0,
    globalBackpressure: false
  });
  const [isRebuilding, setIsRebuilding] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    fetchStats();
    // Realtime stream
    const channel = supabase.channel("system-ops")
      .on('postgres_changes', { event: '*', schema: 'public', table: 'job_queue' }, () => {
        fetchStats();
      })
      .subscribe();
      
    return () => { supabase.removeChannel(channel); }
  }, []);

  const fetchStats = async () => {
    // Busca jobs em processamento e falhos para observabilidade global
    const [{ count: active }, { count: failed }, { data: usage }] = await Promise.all([
      supabase.from("job_queue").select("*", { count: "exact", head: true }).in("status", ["pending", "processing"]),
      supabase.from("job_queue").select("*", { count: "exact", head: true }).eq("status", "failed"),
      supabase.from("v1_read_workspace_metrics").select("total_tokens_consumed")
    ]);

    const totalTokens = usage?.reduce((acc, curr) => acc + (curr.total_tokens_consumed || 0), 0) || 0;
    
    setStats({
      activeJobs: active || 0,
      failedJobs: failed || 0,
      totalTokens,
      globalBackpressure: (active || 0) > 40 // Simulando threshold
    });
  };

  const handleRebuildProjections = async () => {
    if (!confirm("Isso irá truncar e reconstruir todas as Views do CQRS a partir do Log de Eventos. Tem certeza?")) return;
    setIsRebuilding(true);
    try {
      // Chamada para a Edge Function de Rebuild
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/projection-worker/rebuild`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
          'x-webhook-secret': process.env.NEXT_PUBLIC_WEBHOOK_SECRET || '' // Idealmente proxy pelo next api para não expor a secret, mas para admin interno ok por hora
        }
      });
      if (!res.ok) throw new Error("Falha ao invocar rebuild");
      alert("Rebuild assíncrono iniciado com sucesso!");
    } catch (e: any) {
      alert(`Erro: ${e.message}`);
    } finally {
      setIsRebuilding(false);
    }
  };

  const handleReconcileJobs = async () => {
    setIsReconciling(true);
    try {
      const { error } = await supabase.rpc('reconcile_stuck_jobs');
      if (error) throw error;
      alert("Reparo concluído: Jobs órfãos devolvidos à fila.");
      fetchStats();
    } catch (e: any) {
      alert(`Erro no repair daemon: ${e.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-8">
      {/* Header */}
      <div className="max-w-6xl mx-auto mb-10 border-b border-gray-800 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-light tracking-tight flex items-center gap-3">
            <Server className="text-indigo-500 w-8 h-8" />
            Control Plane
          </h1>
          <p className="text-gray-500 mt-2 text-sm tracking-wide uppercase">
            Global Infrastructure & Governance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="relative flex h-3 w-3">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${stats.globalBackpressure ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${stats.globalBackpressure ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          </span>
          <span className="text-sm font-medium text-gray-400">
            {stats.globalBackpressure ? 'Backpressure Active' : 'System Healthy'}
          </span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Metric Cards */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity className="w-24 h-24" /></div>
          <p className="text-gray-500 text-sm font-semibold uppercase tracking-wider mb-2">Active Event Queue</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-light text-white">{stats.activeJobs}</span>
            <span className="text-gray-500 text-sm">jobs in flight</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-red-900/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertOctagon className="w-24 h-24 text-red-500" /></div>
          <p className="text-red-400/80 text-sm font-semibold uppercase tracking-wider mb-2">Dead Letter Queue</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-light text-red-100">{stats.failedJobs}</span>
            <span className="text-red-500/50 text-sm">failed permanently</span>
          </div>
        </div>

        <div className="bg-gray-900 border border-indigo-900/30 rounded-xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Zap className="w-24 h-24 text-indigo-500" /></div>
          <p className="text-indigo-400/80 text-sm font-semibold uppercase tracking-wider mb-2">OpenAI Consumption</p>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-light text-indigo-100">{stats.totalTokens.toLocaleString()}</span>
            <span className="text-indigo-500/50 text-sm">tokens today</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Left Column: Actions */}
        <div className="space-y-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-medium text-gray-200 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5" /> CQRS Operations
            </h2>
            <div className="space-y-4">
              <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-medium">Rebuild Projections Engine</h3>
                    <p className="text-gray-500 text-sm mt-1">Destrói read models e reprocessa o Event Log imutável desde o início.</p>
                  </div>
                  <button 
                    onClick={handleRebuildProjections}
                    disabled={isRebuilding}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isRebuilding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                    {isRebuilding ? 'Rebuilding...' : 'Start Rebuild'}
                  </button>
                </div>
              </div>

              <div className="p-4 bg-gray-950 rounded-lg border border-gray-800">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-white font-medium">Repair Scanner Daemon</h3>
                    <p className="text-gray-500 text-sm mt-1">Busca e liberta jobs "zumbis" que ficaram órfãos após falha de lease do Worker.</p>
                  </div>
                  <button 
                    onClick={handleReconcileJobs}
                    disabled={isReconciling}
                    className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    {isReconciling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Terminal className="w-4 h-4" />}
                    {isReconciling ? 'Scanning...' : 'Run Repair'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Kill Switches */}
          <div className="bg-gray-900/50 border border-red-900/30 rounded-xl p-6">
            <h2 className="text-lg font-medium text-red-400 mb-4 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" /> Global Kill Switches
            </h2>
            <div className="space-y-4">
               <div className="p-4 border border-red-900/50 bg-red-950/20 rounded-lg flex justify-between items-center">
                  <div>
                    <h3 className="text-red-200 font-medium">Halt Worker Pool</h3>
                    <p className="text-red-400/60 text-sm mt-1">Pausa imediata de consumo da Fila. (Backpressure Manual)</p>
                  </div>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-lg transition-colors">
                    HALT SYSTEM
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Logs Feed */}
        <div className="bg-black border border-gray-800 rounded-xl overflow-hidden flex flex-col shadow-2xl">
          <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex justify-between items-center">
            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Live Event Stream
            </span>
            <span className="flex items-center gap-2 text-xs text-gray-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> tailing job_events
            </span>
          </div>
          <div className="p-4 font-mono text-sm h-[500px] overflow-y-auto space-y-2">
             <div className="text-emerald-400">{">"} Event Source Connected...</div>
             <div className="text-gray-500">Waiting for domain events...</div>
             {/* Mock de log stream para ilustrar a UI */}
             <div className="text-gray-400">
               <span className="text-blue-400">[10:45:01]</span> <span className="text-purple-400">EVT_DOMAIN</span> lead_stage_changed (workspace: a1b2...)
             </div>
             <div className="text-gray-400">
               <span className="text-blue-400">[10:45:02]</span> <span className="text-yellow-400">JOB_QUEUED</span> acquire_ai_job pending (correlation_id: f9e8...)
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
