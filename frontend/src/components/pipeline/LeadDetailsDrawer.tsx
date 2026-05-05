"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember, WorkspaceCustomField } from "@/types/database.types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import LeadCustomFieldInputs from "@/components/custom-fields/LeadCustomFieldInputs";
import { buildLeadCustomFieldValuesDraft, type LeadWithCustomFieldValues } from "@/lib/custom-fields";

type LeadDetailsDrawerProps = {
  lead: LeadWithCustomFieldValues | null;
  isOpen: boolean;
  isSaving: boolean;
  isDeleting: boolean;
  stages: Stage[];
  members: WorkspaceMember[];
  campaigns: any[];
  customFields: WorkspaceCustomField[];
  onClose: () => void;
  onSave: (payload: LeadFormPayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveToStage: (stageId: string) => Promise<void>;
};

function buildInitialForm(lead: Lead | null) {
  return {
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    stageId: lead?.stage_id ?? "",
    assignedTo: lead?.assigned_to ?? "",
    company: lead?.company ?? "",
    role: lead?.role ?? "",
    source: lead?.source ?? "",
    notes: lead?.notes ?? "",
    campaignId: lead?.campaign_id ?? "",
    customFieldValues: {},
  };
}

export default function LeadDetailsDrawer({
  lead,
  isOpen,
  isSaving,
  isDeleting,
  stages,
  members,
  campaigns,
  customFields,
  onClose,
  onSave,
  onDelete,
  onMoveToStage,
}: LeadDetailsDrawerProps) {
  const [form, setForm] = useState(() => buildInitialForm(lead));
  const [messages, setMessages] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!lead || !isOpen) {
      return;
    }

    setForm({
      ...buildInitialForm(lead),
      customFieldValues: buildLeadCustomFieldValuesDraft(lead, customFields),
    });
  }, [lead, isOpen, customFields]);

  if (!isOpen || !lead) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onSave({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      company: form.company.trim() || null,
      role: form.role.trim() || null,
      source: form.source.trim() || null,
      notes: form.notes.trim() || null,
      stageId: form.stageId,
      assignedTo: form.assignedTo || null,
      campaignId: form.campaignId || null,
      customFieldValues: form.customFieldValues,
    });
  };

  const handleGenerateMessages = async () => {
    if (!form.campaignId) {
      toast.error("Selecione uma campanha para gerar as mensagens.");
      return;
    }
    
    setLoadingMessages(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-message", {
        body: {
          lead_id: lead.id,
          campaign_id: form.campaignId,
          variations_count: 3,
        },
      });
      
      if (error) throw error;
      
      // A Edge Function retorna { messages: string[] }
      if (data?.messages) {
        setMessages(data.messages);
      }
    } catch (error: any) {
      console.error("[GENERATE_ERROR]", error);
      toast.error(error?.message || "Erro ao gerar mensagens.");
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleSend = async (content: string) => {
    if (isSending) return;
    
    setIsSending(true);
    try {
      const { data, error } = await (supabase.rpc as any)("send_message_and_move_lead", {
        p_lead_id: lead.id,
        p_content: content,
        p_campaign_id: form.campaignId || null
      });

      if (error) throw error;

      toast.success("Mensagem enviada com sucesso! O lead foi movido para a etapa de contato.");
      
      // Fecha o drawer e recarrega o pipeline para refletir a mudança de etapa
      onClose();
      window.location.reload(); // Forma simples de atualizar o pipeline, ou use loadPipeline se disponível
    } catch (error: any) {
      console.error("[SEND_ERROR]", error);
      toast.error(error?.message || "Erro ao enviar mensagem.");
    } finally {
      setIsSending(false);
    }
  };



  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <Surface className="h-full w-full max-w-lg overflow-y-auto rounded-none border-l-0 p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Detalhes do Lead</h2>
          <Button type="button" variant="secondary" onClick={onClose}>
            Fechar
          </Button>
        </div>

        <div className="mb-4 rounded-lg border border-slate-700/70 bg-slate-900/70 p-3 text-xs text-slate-300">
          <p><span className="font-mono text-slate-500">ID:</span> {lead.id}</p>
          <p><span className="font-mono text-slate-500">Workspace:</span> {lead.workspace_id}</p>
          <p><span className="font-mono text-slate-500">Criado em:</span> {lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}</p>
          <p><span className="font-mono text-slate-500">Atualizado em:</span> {lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "-"}</p>
        </div>

        {/* Phase 10: AI Insight Card */}
        {(lead as any).lead_insights?.[0] && (() => {
          const insight = (lead as any).lead_insights[0];
          return (
            <div className="mb-5 rounded-xl border border-slate-700/60 bg-gradient-to-br from-indigo-950/40 to-slate-900/80 p-4 shadow-lg ring-1 ring-white/5">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                    🧠
                  </span>
                  <h3 className="font-bold text-white">AI Sales Insight</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 
                    ${insight.sentiment === 'hot' ? 'bg-rose-500/20 text-rose-300 ring-rose-500/40' : 
                      insight.sentiment === 'warm' ? 'bg-amber-500/20 text-amber-300 ring-amber-500/40' : 
                      'bg-blue-500/20 text-blue-300 ring-blue-500/40'}`}>
                    {insight.sentiment.toUpperCase()}
                  </span>
                  <span className="text-lg font-black text-white">{insight.score}%</span>
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ação Recomendada (Next Best Action)</p>
                  <p className="text-sm font-semibold text-emerald-300">{insight.recommended_action}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Raciocínio</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{insight.reasoning}</p>
                </div>
              </div>
            </div>
          );
        })()}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <TextField
            label="Nome"
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            required
            minLength={3}
          />

          <TextField
            label="Email"
            value={form.email}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
            type="email"
          />

          <TextField
            label="Telefone"
            value={form.phone}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Empresa"
              value={form.company}
              onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
              placeholder="Nome da empresa"
            />
            <TextField
              label="Cargo"
              value={form.role}
              onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              placeholder="Ex: CEO"
            />
          </div>

          <TextField
            label="Origem do Lead"
            value={form.source}
            onChange={(event) => setForm((current) => ({ ...current, source: event.target.value }))}
            placeholder="Ex: LinkedIn, Indicação..."
          />

          <LeadCustomFieldInputs
            fields={customFields}
            values={form.customFieldValues}
            onChange={(fieldId, value) => setForm((current) => ({
              ...current,
              customFieldValues: {
                ...current.customFieldValues,
                [fieldId]: value,
              },
            }))}
          />

          <div className="space-y-1.5">

            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Observações</label>
            <textarea
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
              placeholder="Notas sobre o lead..."
            />
          </div>

          <SelectField
            label="Etapa"
            value={form.stageId}
            onChange={(event) => setForm((current) => ({ ...current, stageId: event.target.value }))}
            required
          >
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Responsável"
            value={form.assignedTo}
            onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
          >
            <option value="">Sem responsável</option>
            {members.map((member) => (
              <option key={member.id} value={member.userId}>
                {member.displayName} {member.role ? `(${member.role})` : ""}
              </option>
            ))}
          </SelectField>

          {/* Seletor de Campanha movido para ser o último antes das ações ou integrado ao painel de IA */}
          <SelectField
            label="Campanha para IA"
            value={form.campaignId}
            onChange={(event) => setForm((current) => ({ ...current, campaignId: event.target.value }))}
          >
            <option value="">Nenhuma campanha</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </SelectField>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isSaving || !form.name.trim() || !form.stageId} className="flex-1">
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button type="button" variant="danger" disabled={isSaving || isDeleting} onClick={onDelete}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>

        </form>

        <section className="mt-8 space-y-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">💬</span>
              <h3 className="font-bold text-white">Mensagens IA</h3>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerateMessages}
              disabled={loadingMessages || !form.campaignId}
              className="text-xs"
            >
              {loadingMessages ? "Gerando..." : "✨ Gerar Sugestões"}
            </Button>

          </div>

          <div className="space-y-4">
            {messages.length === 0 && (
              <p className="py-4 text-center text-xs text-slate-500 italic">
                Nenhuma mensagem gerada para este lead ainda.
              </p>
            )}
            {messages.map((content, idx) => (
              <div key={idx} className="group relative rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-indigo-500/40">
                <p className="text-sm leading-relaxed text-slate-200">{content}</p>
                <div className="mt-3 flex items-center justify-end border-t border-slate-700/50 pt-3">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-2 py-1 text-[10px]"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(content);
                          alert("Mensagem copiada para a área de transferência! 📋");
                        } catch (err) {
                          console.error("Erro ao copiar:", err);
                          alert("Não foi possível copiar automaticamente. Por favor, selecione o texto e copie manualmente.");
                        }
                      }}
                    >
                      Copiar
                    </Button>

                    <Button
                      type="button"
                      variant="primary"
                      className="px-2 py-1 text-[10px]"
                      disabled={isSending}
                      onClick={() => handleSend(content)}
                    >
                      {isSending ? "Enviando..." : "Enviar"}
                    </Button>

                  </div>
                </div>
              </div>
            ))}

          </div>
        </section>

      </Surface>
    </div>
  );
}
