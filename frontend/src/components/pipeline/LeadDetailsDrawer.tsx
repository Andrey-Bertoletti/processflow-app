"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember, Campaign } from "@/types/database.types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";

type LeadDetailsDrawerProps = {
  lead: Lead | null;
  isOpen: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  stages: Stage[];
  members: WorkspaceMember[];
  onClose: () => void;
  onSave: (payload: LeadFormPayload) => Promise<void>;
  onDelete: () => Promise<void>;
};

export default function LeadDetailsDrawer({
  lead,
  isOpen,
  isSaving,
  isDeleting,
  stages,
  members,
  onClose,
  onSave,
  onDelete,
}: LeadDetailsDrawerProps) {
  // --- Estados Locais ---
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [campaignId, setCampaignId] = useState<string | null>(null);
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [aiMessage, setAiMessage] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<"idle" | "cached" | "generated" | "error">("idle");
  const [generationError, setGenerationError] = useState<string | null>(null);

  // --- Efeito para Sincronizar Dados quando o Lead selecionado muda ---
  useEffect(() => {
    if (!lead) return;

    // Sincroniza campos apenas quando o lead.id muda para evitar resets indesejados
    setName(lead.name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setStageId(lead.stage_id || "");
    setAssignedTo(lead.assigned_to || null);
    setCampaignId(lead.campaign_id || null);
    setAiMessage(""); 

    const fetchCampaigns = async () => {
      try {
        const { data, error } = await supabase
          .from("campaigns")
          .select("*")
          .eq("workspace_id", lead.workspace_id);
        
        if (error) throw error;
        setCampaigns(data || []);
      } catch (err) {
        console.error("[CAMPAIGN_FETCH_ERR]", err);
      }
    };

    fetchCampaigns();
  }, [lead?.id]); // Dependência no ID garante que não resetamos se o objeto lead mudar por revalidação

  // --- Handlers ---
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedPhone = phone.trim().replace(/\D/g, "");
    
    await onSave({
      name: name.trim(),
      email: email.trim() || null,
      phone: normalizedPhone || null,
      stageId,
      assignedTo: assignedTo || null,
      campaignId: campaignId || null,
    });
  };

  const handleGenerateAI = async (force: boolean = false) => {
    if (!campaignId) return alert("Selecione uma campanha primeiro.");
    
    setGenerating(true);
    setGenerationStatus("idle");
    setGenerationError(null);
    try {
      const response = await fetch("/api/generate-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: lead?.id, campaignId, force })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro na IA");
      
      setAiMessage(data.message);
      setGenerationStatus(data.cached ? "cached" : "generated");
    } catch (e: any) {
      console.error("[AI_GENERATE_ERR]", e);
      setGenerationError(e.message || "Falha ao gerar mensagem com IA.");
      setGenerationStatus("error");
    } finally {
      setGenerating(false);
    }
  };

  // Renderização condicional fora do ciclo de vida dos Hooks
  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <Surface className="h-full w-full max-w-lg overflow-y-auto rounded-none border-l-0 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Detalhes do Lead</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p><span className="text-slate-500 font-mono">ID:</span> {lead.id}</p>
          <p><span className="text-slate-500 font-mono">Workspace:</span> {lead.workspace_id}</p>
          <p><span className="text-slate-500 font-mono">Criado em:</span> {lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <TextField
            label="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
          />

          <TextField
            label="Telefone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <SelectField
            label="Etapa"
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            required
          >
            {stages.map((stage: Stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Responsável"
            value={assignedTo ?? ""}
            onChange={(e) => setAssignedTo(e.target.value || null)}
          >
            <option value="">Sem responsável</option>
            {members.map((member: WorkspaceMember) => (
              <option key={member.id} value={member.userId}>
                {member.displayName} {member.role ? `(${member.role})` : ""}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Campanha"
            value={campaignId ?? ""}
            onChange={(e) => setCampaignId(e.target.value || null)}
          >
            <option value="">Sem campanha</option>
            {campaigns.map((c: Campaign) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isSaving || !name.trim() || !stageId}
              className="flex-1"
            >
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={isSaving || isDeleting}
              onClick={onDelete}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </form>

        <section className="mt-8 rounded-lg border border-dashed border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-white">Histórico</h3>
          <p className="mt-2 text-xs text-slate-400 italic">
            Sem mensagens ainda. Este painel será conectado com a tabela messages na próxima fase.
          </p>
        </section>

        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700/50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              ✨ Comunicação com IA
            </h3>
            {generationStatus === "cached" && (
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                ✅ Cache
              </span>
            )}
            {generationStatus === "generated" && (
              <span className="text-xs bg-green-900/40 text-green-300 px-2 py-0.5 rounded flex items-center gap-1">
                ✅ Nova Geração
              </span>
            )}
          </div>

          {generationError && (
            <div className="mb-3 p-2 bg-red-900/30 border border-red-800/50 rounded flex items-start gap-2">
              <span className="text-xs text-red-300">⚠️ {generationError}</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="primary"
              disabled={generating || !campaignId}
              onClick={() => handleGenerateAI(false)}
              className="flex-1"
            >
              {generating ? "Gerando Mensagem..." : "Gerar mensagem com IA"}
            </Button>
            
            {(generationStatus === "cached" || generationStatus === "generated") && (
              <Button
                type="button"
                variant="secondary"
                disabled={generating}
                title="Forçar nova geração ignorando o cache"
                onClick={() => handleGenerateAI(true)}
              >
                Regerar
              </Button>
            )}
          </div>

          {aiMessage && (
            <div className="mt-4 animate-in fade-in slide-in-from-top-1">
              <label className="block text-slate-300 text-xs mb-1">Mensagem Final</label>
              <textarea
                className="w-full p-3 bg-slate-900 text-white rounded border border-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 min-h-[120px] text-sm"
                value={aiMessage}
                onChange={e => setAiMessage(e.target.value)}
              />
              <div className="flex justify-end mt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    navigator.clipboard.writeText(aiMessage);
                    alert("Copiado!");
                  }}
                >
                  Copiar Texto
                </Button>
              </div>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}