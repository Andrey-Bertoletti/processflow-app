"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { User, MessageSquare, Bot, MoveRight, FileText } from "lucide-react";

type Activity = {
  id: string;
  type: 'lead_created' | 'stage_change' | 'ai_message' | 'manual_message' | 'note';
  content: any;
  created_at: string;
  created_by: string | null;
  event_sequence?: number; // Adicionado do DB
};

type TimelineFilter = 'all' | 'stage_change' | 'messages' | 'notes';

type LeadTimelineProps = {
  leadId: string;
};

export function LeadTimeline({ leadId }: LeadTimelineProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TimelineFilter>('all');
  const [debugMode, setDebugMode] = useState(false);
  
  // Semantic Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [semanticAnalysis, setSemanticAnalysis] = useState<{
    summary: string;
    engagement_status: string;
    suggested_action: string;
  } | null>(null);

  useEffect(() => {
    fetchActivities();
    
    // Escuta novas atividades em tempo real (Com DEDUPLICAÇÃO)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any;
    const channel = db.channel(`timeline-${leadId}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'activities',
        filter: `lead_id=eq.${leadId}`
      }, (payload: any) => {
        const newActivity = payload.new as Activity;
        setActivities((prev) => {
          if (prev.some(a => a.id === newActivity.id)) return prev;
          const newList = [newActivity, ...prev];
          // Ordena por sequence se existir, senão created_at
          return newList.sort((a, b) => {
            if (a.event_sequence && b.event_sequence) return b.event_sequence - a.event_sequence;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });
        });
      })
      .subscribe();

    return () => { db.removeChannel(channel); };
  }, [leadId]);

  const fetchActivities = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('activities')
      .select('*')
      .eq('lead_id', leadId)
      .order('event_sequence', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }); // Fallback para linhas velhas
      
    if (!error && data) {
      setActivities(data);
    }
    setLoading(false);
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'lead_created': return <User className="w-4 h-4 text-emerald-500" />;
      case 'stage_change': return <MoveRight className="w-4 h-4 text-blue-500" />;
      case 'ai_message': return <Bot className="w-4 h-4 text-purple-500" />;
      case 'manual_message': return <MessageSquare className="w-4 h-4 text-indigo-500" />;
      case 'note': return <FileText className="w-4 h-4 text-amber-500" />;
      default: return <div className="w-2 h-2 rounded-full bg-gray-400" />;
    }
  };

  const handleGenerateAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/semantic-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId })
      });
      if (res.ok) {
        const { analysis } = await res.json();
        setSemanticAnalysis(analysis);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    if (filter === 'stage_change') return activity.type === 'stage_change' || activity.type === 'lead_created';
    if (filter === 'messages') return activity.type === 'ai_message' || activity.type === 'manual_message';
    if (filter === 'notes') return activity.type === 'note';
    return true;
  });

  // AGRUPAMENTO DE EVENTOS POR DATA (Event Grouping)
  const groupedActivities = filteredActivities.reduce((acc, activity) => {
    const dateKey = format(new Date(activity.created_at), 'yyyy-MM-dd');
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(activity);
    return acc;
  }, {} as Record<string, Activity[]>);

  if (loading) {
    return <div className="animate-pulse space-y-4 py-4">
      {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-lg" />)}
    </div>;
  }

  return (
    <div className="space-y-6">
      {/* Filtros da Timeline e Opções Avançadas */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/50 pb-4">
        <div className="flex flex-wrap gap-2">
          {(['all', 'stage_change', 'messages', 'notes'] as TimelineFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                filter === f 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {f === 'all' ? 'Tudo' : f === 'stage_change' ? 'Pipeline' : f === 'messages' ? 'Mensagens' : 'Notas'}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-400 hover:text-white transition-colors">
            <input 
              type="checkbox" 
              checked={debugMode} 
              onChange={(e) => setDebugMode(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-indigo-500"
            />
            Modo Debug (Snapshot)
          </label>
          <button 
            onClick={handleGenerateAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {isAnalyzing ? <span className="animate-spin text-sm leading-none">⚙</span> : <Bot className="w-3.5 h-3.5" />}
            {isAnalyzing ? 'Analisando...' : 'Análise IA'}
          </button>
        </div>
      </div>

      {semanticAnalysis && (
        <div className="bg-gradient-to-r from-emerald-950/40 to-slate-900 border border-emerald-500/20 rounded-xl p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            <h4 className="text-sm font-semibold text-emerald-300">Semantic Layer (Visão Estratégica)</h4>
          </div>
          <p className="text-sm text-slate-300 mb-3">{semanticAnalysis.summary}</p>
          <div className="flex flex-wrap gap-3">
            <span className="px-2 py-1 text-xs font-medium bg-emerald-900/50 text-emerald-200 rounded-md border border-emerald-700/50">
              Humor: {semanticAnalysis.engagement_status}
            </span>
            <span className="px-2 py-1 text-xs font-medium bg-indigo-900/50 text-indigo-200 rounded-md border border-indigo-700/50">
              Ação Sugerida: {semanticAnalysis.suggested_action}
            </span>
          </div>
        </div>
      )}

      <div className="relative pl-4 space-y-8 mt-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-700/50 before:to-transparent">
        {Object.entries(groupedActivities).map(([date, dayActivities], groupIndex) => {
          // Label do Agrupamento de Data
          const dateObj = new Date(date + 'T00:00:00');
          const isTodayDate = format(new Date(), 'yyyy-MM-dd') === date;
          const isYesterdayDate = format(new Date(Date.now() - 86400000), 'yyyy-MM-dd') === date;
          const dateLabel = isTodayDate ? "Hoje" : isYesterdayDate ? "Ontem" : format(dateObj, "d 'de' MMMM", { locale: ptBR });

          return (
            <div key={date} className="relative">
              {/* Header do Dia */}
              <div className="sticky top-0 z-20 flex items-center justify-center mb-6">
                <span className="bg-slate-900 border border-slate-700 text-slate-300 text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
                  {dateLabel}
                </span>
              </div>

              <div className="space-y-8">
                {dayActivities.map((activity, index) => {
                  const isFirst = index === 0 && groupIndex === 0;
                  return (
                    <div key={activity.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      {/* Ícone (Timeline Node) */}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-800 ${isFirst ? 'bg-indigo-900/80 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-slate-900'} shadow shrink-0 z-10`}>
                        {getEventIcon(activity.type)}
                      </div>

                      {/* Conteúdo */}
                      <div className="w-[calc(100%-3rem)] ml-4 bg-slate-800/80 border border-slate-700/50 rounded-xl p-4 shadow-sm hover:border-slate-600 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                            {activity.type === 'stage_change' ? 'Mudança de Etapa' :
                             activity.type === 'ai_message' ? 'Gerado por IA' :
                             activity.type === 'lead_created' ? 'Lead Criado' :
                             activity.type === 'manual_message' ? 'Mensagem Manual' : 'Nota'}
                          </span>
                          <time className="text-xs text-slate-500">
                            {format(new Date(activity.created_at), "HH:mm")}
                          </time>
                        </div>

                        {/* Corpo da Atividade */}
                        <div className="text-sm text-slate-300 mt-2">
                          {activity.type === 'lead_created' && (
                            <p>Lead adicionado ao funil.</p>
                          )}
                          {activity.type === 'stage_change' && (
                            <p>
                              Movido para <span className="font-semibold text-white bg-slate-700 px-2 py-0.5 rounded ml-1">{activity.content?.new_stage_name}</span>
                            </p>
                          )}
                          {(activity.type === 'ai_message' || activity.type === 'manual_message') && (
                            <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg mt-2 text-slate-300 italic">
                              "{activity.content?.content}"
                            </div>
                          )}
                          {debugMode && activity.content?.snapshot && (
                            <div className="mt-3 p-2 bg-[#0d1728] border border-slate-700/50 rounded text-xs font-mono text-slate-400 overflow-x-auto">
                              <div className="text-[10px] text-slate-500 mb-1 border-b border-slate-800 pb-1 flex justify-between">
                                <span>SNAPSHOT TEMPORAL (JSON)</span>
                                {activity.event_sequence && <span>SEQ: {activity.event_sequence}</span>}
                              </div>
                              <pre>{JSON.stringify(activity.content.snapshot, null, 2)}</pre>
                            </div>
                          )}
                        </div>

                        {/* Autor / Rodapé do Evento */}
                        <div className="mt-3 flex items-center gap-2 border-t border-slate-700/50 pt-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${activity.created_by ? 'bg-emerald-900/50 text-emerald-400' : 'bg-indigo-900/50 text-indigo-400'}`}>
                            {activity.created_by ? 'US' : 'IA'}
                          </div>
                          <span className="text-xs text-slate-500">
                            {activity.created_by ? 'Ação do Usuário' : 'Ação Automatizada'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {filteredActivities.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
            Nenhuma atividade encontrada neste filtro.
          </div>
        )}
      </div>
    </div>
  );
}
