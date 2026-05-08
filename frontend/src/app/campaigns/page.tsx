"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import type { Campaign } from "@/types/database.types";
import CampaignForm from "@/components/campaign/CampaignForm";
import { useAuth } from "@/app/context/AuthContext";
import useWorkspaceAdmin from "@/hooks/useWorkspaceAdmin";
import { toast } from "sonner";

export default function CampaignsPage() {
  const router = useRouter();
  const { activeWorkspaceId } = useAuth();
  const { isAdmin } = useWorkspaceAdmin(activeWorkspaceId, Boolean(activeWorkspaceId));
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [edit, setEdit] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = async () => {
    if (!activeWorkspaceId) {
      setCampaigns([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("workspace_id", activeWorkspaceId)
      .order("created_at", { ascending: false });
    if (error) console.error("[CAMPAIGN_LOAD_ERR]", error);
    else setCampaigns(data || []);
    setIsLoading(false);
  };

  useEffect(() => {
    load();
  }, [activeWorkspaceId]);

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error("Apenas administradores podem excluir campanhas.");
      return;
    }
    if (!confirm("Deseja realmente excluir esta campanha?")) return;
    const { error } = await supabase.from("campaigns").delete().eq("id", id);
    if (error) {
      console.error("[CAMPAIGN_DEL_ERR]", error);
      toast.error(error.message || "Erro ao excluir campanha.");
    } else {
      toast.success("Campanha excluída.");
      load();
    }
  };

  return (
    <main className="app-shell p-8">
      <header className="app-enter mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="app-pill mb-2">Estratégia de IA</span>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Campanhas</h1>
          <p className="text-slate-400 mt-1">Gerencie o contexto e instruções para geração de mensagens automáticas.</p>
        </div>
        {isAdmin ? (
          <Button
            onClick={() => {
              setEdit(null);
              setIsOpen(true);
            }}
            className="h-fit"
          >
            ✨ Nova Campanha
          </Button>
        ) : (
          <span className="app-pill">Somente leitura</span>
        )}
      </header>

      {!activeWorkspaceId ? (
        <Surface className="p-12 text-center">
          <h3 className="text-lg font-semibold text-white">Selecione um workspace</h3>
          <p className="text-slate-400 mt-2">Escolha um workspace no dashboard para ver campanhas.</p>
          <Button variant="secondary" className="mt-6" onClick={() => router.push("/auth/dashboard")}>
            Ir para dashboard
          </Button>
        </Surface>
      ) : isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2].map(i => (
            <Surface key={i} className="p-6 h-48 animate-pulse bg-slate-800/20" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <Surface className="p-12 text-center border-dashed">
          <div className="text-4xl mb-4">📢</div>
          <h3 className="text-lg font-semibold text-white">Nenhuma campanha encontrada</h3>
          <p className="text-slate-400 mt-2 max-w-xs mx-auto">
            Crie sua primeira campanha para começar a usar o poder da IA no seu funil de vendas.
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={() => (isAdmin ? setIsOpen(true) : toast.error("Apenas administradores podem criar campanhas."))}
          >
            Começar Agora
          </Button>
        </Surface>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 app-enter">
          {campaigns.map(c => (
            <Surface key={c.id} className="group p-6 flex flex-col hover:border-blue-500/30 transition-all duration-300">
              <div className="flex-1">
                <div className="flex items-start justify-between mb-3">
                   <h2 className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">{c.name}</h2>
                   <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Workspace</span>
                </div>
                <p className="text-sm text-slate-300 line-clamp-3 mb-4 leading-relaxed">{c.context}</p>
                <div className="bg-slate-950/40 rounded-lg p-3 border border-slate-800/50">
                   <span className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Prompt Base</span>
                   <p className="text-[11px] text-slate-400 italic line-clamp-2">"{c.base_prompt}"</p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-6 pt-4 border-t border-slate-800/50">
                {isAdmin ? (
                  <>
                    <Button variant="secondary" className="flex-1 text-xs" onClick={() => { setEdit(c); setIsOpen(true); }}>
                      Editar
                    </Button>
                    <Button variant="danger" className="px-4 text-xs" onClick={() => handleDelete(c.id)}>
                      Excluir
                    </Button>
                  </>
                ) : (
                  <Button variant="secondary" className="w-full text-xs" onClick={() => toast("Somente admins podem editar campanhas.")}>
                    Ver detalhes
                  </Button>
                )}
              </div>
            </Surface>
          ))}
        </div>
      )}

      {isOpen && isAdmin && (
        <CampaignForm
          campaign={edit}
          onClose={() => setIsOpen(false)}
          onSaved={load}
        />
      )}
    </main>
  );
}
