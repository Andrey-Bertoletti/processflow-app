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
  customFields: any[];
  customFieldValues?: any[]; // Adicionado: valores relacionais
  onClose: () => void;
  onSave: (payload: LeadFormPayload) => Promise<void>;
  onDelete: () => Promise<void>;
  onMoveToStage: (stageId: string) => Promise<void>;
};

function buildInitialForm(lead: Lead | null, customFieldValues: any[] = []) {
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
    metadata: (lead?.metadata as Record<string, any>) ?? {},
    customValues: buildCustomValuesMap(customFieldValues || []), // Mapeia id_campo -> valor
  };
}

function buildCustomValuesMap(values: any[]) {
  const map: Record<string, string> = {};
  values.forEach(v => {
    map[v.custom_field_id] = v.value || "";
  });
  return map;
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
  customFieldValues,
  onClose,
  onSave,
  onDelete,
  onMoveToStage,
}: LeadDetailsDrawerProps) {
  const [form, setForm] = useState(() => buildInitialForm(lead, customFieldValues));
  const [messages, setMessages] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (!lead || !isOpen) {
      return;
    }

    setForm(buildInitialForm(lead, customFieldValues));
  }, [lead, isOpen, customFieldValues]);

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
      metadata: form.metadata,
      customValues: form.customValues, // Novo: Enviado para o handler de salvamento
    } as LeadFormPayload);
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

  const handleSend = async (messageId: string) => {
    if (isSending || !user) return;
    
    setIsSending(true);
    try {
      const { data, error } = await (supabase.rpc as any)("send_message_simulated", {
        p_message_id: messageId,
        p_lead_id: lead.id,
        p_user_id: user.id
      });

      if (error) throw error;

      toast.success("Abordagem iniciada! Lead movido para 'Tentando Contato'.");
      
      onClose();
      window.location.reload(); 
    } catch (error: any) {
      console.error("[SEND_ERROR]", error);
      toast.error(error?.message || "Erro ao simular envio.");
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

          {customFields.map((field) => (
            <TextField
              key={field.id}
              label={field.label || field.name}
              type={field.field_type === 'number' ? 'number' : 'text'}
              value={form.customValues[field.id] || ""}
              onChange={(event) => setForm((current) => ({
                ...current,
                customValues: {
                  ...current.customValues,
                  [field.id]: event.target.value
                }
              }))}
              placeholder={`Preencha ${ (field.label || field.name).toLowerCase() }...`}
              required={field.is_required}
            />
          ))}

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
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleGenerateMessages(false)}
                disabled={loadingMessages || !form.campaignId}
                className="text-xs"
              >
                {loadingMessages ? "Buscando..." : "✨ Ver Sugestões"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleGenerateMessages(true)}
                disabled={loadingMessages || !form.campaignId}
                className="text-xs"
                title="Forçar IA a gerar novas opções"
              >
                {loadingMessages ? "Gerando..." : "🔄 Regenerar"}
              </Button>
            </div>


          </div>

          <div className="space-y-4">
            {messages.length === 0 && !(lead as any).messages?.length && (
              <p className="py-4 text-center text-xs text-slate-500 italic">
                Nenhuma mensagem gerada para este lead ainda.
              </p>
            )}
            
            {(lead as any).messages?.map((msg: any, idx: number) => {
              const styles = ["Direto", "Consultivo", "Criativo"];
              return (
                <div key={msg.id} className="group relative rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-indigo-500/40">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-400">Estilo: {msg.metadata?.style || styles[msg.variation_index] || "IA"}</span>
                    {msg.status === 'sent' && <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">ENVIADA</span>}
                  </div>
                  <p className="text-sm leading-relaxed text-slate-200">{msg.content}</p>
                  <div className="mt-3 flex items-center justify-end border-t border-slate-700/50 pt-3">
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-2 py-1 text-[10px]"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(msg.content);
                            toast.success("Copiado!");
                          } catch (err) {
                            alert("Copie manualmente: " + msg.content);
                          }
                        }}
                      >
                        Copiar
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        className="px-2 py-1 text-[10px]"
                        disabled={isSending || msg.status === 'sent'}
                        onClick={() => handleSend(msg.id)}
                      >
                        {isSending ? "Enviando..." : msg.status === 'sent' ? "Enviada" : "Enviar"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}

          </div>
        </section>
        
        {/* Phase 11: Timeline Section */}
        <section className="mt-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
            <span className="text-xl">⏳</span>
            <h3 className="font-bold text-white">Linha do Tempo</h3>
          </div>
          
          <div className="space-y-4">
            {((lead as any).lead_events || []).length === 0 && (
              <p className="text-center text-xs text-slate-500 italic py-2">Sem histórico disponível.</p>
            )}
            
            {((lead as any).lead_events || [])
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((event: any) => (
                <div key={event.id} className="relative pl-6 border-l-2 border-slate-700 pb-2 last:pb-0">
                  <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-2 border-slate-900 bg-indigo-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {new Date(event.created_at).toLocaleString()}
                    </span>
                    <p className="text-xs font-semibold text-slate-200">
                      {event.type === 'message_sent' ? '📨 Mensagem Enviada' : 
                       event.type === 'stage_changed' ? '🚀 Mudança de Etapa' : event.type}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{event.description}</p>
                  </div>
                </div>
              ))}
          </div>
        </section>

      </Surface>
    </div>
  );
}
