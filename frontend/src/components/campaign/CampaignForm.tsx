"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import type { Campaign } from "@/types/database.types";
import { useAuth } from "@/app/context/AuthContext";

type Props = {
  campaign?: Campaign | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function CampaignForm({ campaign, onClose, onSaved }: Props) {
  const [name, setName] = useState(campaign?.name ?? "");
  const [context, setContext] = useState(campaign?.context ?? "");
  const [basePrompt, setBasePrompt] = useState(campaign?.base_prompt ?? "");
  const [isSaving, setIsSaving] = useState(false);
  
  const { activeWorkspaceId } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId) return;

    setIsSaving(true);
    const payload = {
      name: name.trim(),
      context: context.trim(),
      base_prompt: basePrompt.trim(),
      workspace_id: activeWorkspaceId,
    };

    const { error } = campaign
      ? await supabase
          .from("campaigns")
          .update({ name: payload.name, context: payload.context, base_prompt: payload.base_prompt })
          .eq("id", campaign.id)
      : await supabase.from("campaigns").insert(payload);

    if (error) {
      console.error("[CAMPAIGN_SAVE_ERR]", error);
      alert("Erro ao salvar campanha.");
    } else {
      onSaved();
      onClose();
    }
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <Surface className="app-enter w-full max-w-xl p-8 relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <header className="mb-8">
          <span className="app-pill mb-3">Configuração</span>
          <h2 className="text-2xl font-bold text-white">
            {campaign ? "Editar Campanha" : "Nova Campanha"}
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Defina como a IA deve se comportar para este grupo de leads.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="app-label">Nome da Campanha</label>
            <input
              className="app-input"
              placeholder="Ex: Black Friday 2024"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              minLength={3}
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <label className="app-label">Contexto do Negócio / Produto</label>
            <p className="text-[10px] text-slate-500 mb-1">Descreva o que está sendo vendido ou o objetivo da campanha.</p>
            <textarea
              className="app-textarea h-28 resize-none"
              placeholder="Ex: Estamos oferecendo 30% de desconto no software de gestão para novos clientes..."
              value={context}
              onChange={e => setContext(e.target.value)}
              required
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <label className="app-label">Prompt Base (Instruções para a IA)</label>
            <p className="text-[10px] text-slate-500 mb-1">Como a IA deve escrever? Tom de voz, restrições, etc.</p>
            <textarea
              className="app-textarea h-28 resize-none"
              placeholder="Ex: Use um tom amigável e focado em benefícios. Não use emojis. Termine sempre com uma pergunta."
              value={basePrompt}
              onChange={e => setBasePrompt(e.target.value)}
              required
              disabled={isSaving}
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-800/50">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? "Salvando..." : "Salvar Campanha"}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}
