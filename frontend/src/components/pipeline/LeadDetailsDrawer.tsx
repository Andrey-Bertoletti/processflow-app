"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Json, LeadFormPayload, Stage, WorkspaceCustomField, WorkspaceMember } from "@/types/database.types";
import { useAuth } from "@/app/context/AuthContext";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, History, MessageSquare, RefreshCw, Send, Sparkles, Zap } from "lucide-react";
import LeadCustomFieldInputs from "@/components/custom-fields/LeadCustomFieldInputs";
import { buildLeadCustomFieldValuesDraft, type LeadWithCustomFieldValues } from "@/lib/custom-fields";
import { LeadTimeline } from "./LeadTimeline";

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
  onAfterSend?: () => void;
};

type LeadDetailsFormState = {
  name: string;
  email: string;
  phone: string;
  stageId: string;
  assignedTo: string;
  company: string;
  role: string;
  source: string;
  notes: string;
  campaignId: string;
  customFieldValues: Record<string, Json | null>;
};

function buildInitialForm(lead: LeadWithCustomFieldValues | null, customFields: WorkspaceCustomField[]): LeadDetailsFormState {
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
    customFieldValues: buildLeadCustomFieldValuesDraft(lead, customFields),
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
  onAfterSend,
}: LeadDetailsDrawerProps) {
  const [form, setForm] = useState(() => buildInitialForm(lead, customFields));
  const [messages, setMessages] = useState<any[]>([]);
  const [messagesError, setMessagesError] = useState<string | null>(null);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const leadId = lead?.id ?? null;

  const refreshMessages = useCallback(async () => {
    if (!leadId) return;

    setIsLoadingMessages(true);
    setMessagesError(null);
    try {
      const { data, error } = await supabase
        .from("messages")
        .select("id, lead_id, campaign_id, content, status, variation_index, is_automated, metadata, created_at, updated_at, sent_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("[MESSAGES_LOAD_ERR]", error);
        setMessagesError(error.message);
        return;
      }

      setMessages(Array.isArray(data) ? data : []);
    } finally {
      setIsLoadingMessages(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (!lead || !isOpen) {
      return;
    }

    setForm(buildInitialForm(lead, customFields));
    setMessages(Array.isArray((lead as any).messages) ? (lead as any).messages : []);
    void refreshMessages();
  }, [lead, isOpen, customFields, refreshMessages]);

  const hasPendingMessages = useMemo(() => messages.some((m) => m?.status === "pending"), [messages]);

  useEffect(() => {
    if (!isOpen || !leadId) return;
    if (!hasPendingMessages) return;

    const intervalId = setInterval(() => {
      void refreshMessages();
    }, 4000);

    return () => clearInterval(intervalId);
  }, [hasPendingMessages, isOpen, leadId, refreshMessages]);

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

  const handleGenerateMessages = async (forceRegenerate = false, campaignIdOverride?: string) => {
    const targetCampaignId = campaignIdOverride ?? form.campaignId;
    if (!targetCampaignId) {
      toast.error("Selecione uma campanha primeiro.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-message", {
        body: { 
          lead_id: lead.id, 
          campaign_id: targetCampaignId,
          variations_count: 3,
          force_regenerate: forceRegenerate
        },
      });
      
      if (error) throw error;
      
      if (data?.success === false) {
        throw new Error(data.detail || data.error || "Erro na geração da IA");
      }
      
      if (data?.messages) {
        await refreshMessages();
        toast.success(forceRegenerate ? "Novas sugestões geradas!" : "Sugestões geradas!");
      }
    } catch (error: any) {
      console.error("[GENERATE_ERROR]", error);
      const detail = error?.message || "Erro desconhecido";
      toast.error(`Erro: ${detail}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async (messageId: string) => {
    if (isSending || !user) return;
    
    setIsSending(true);
    try {
      const { error } = await (supabase.rpc as any)("send_message_simulated", {
        p_message_id: messageId,
        p_lead_id: lead.id
      });

      if (error) throw error;

      toast.success("Abordagem iniciada! Lead movido para 'Tentando Contato'.");
      await refreshMessages();
      onAfterSend?.();
      onClose();
    } catch (error: any) {
      console.error("[SEND_ERROR]", error);
      toast.error(error?.message || "Erro ao simular envio.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <Surface className="h-full w-full sm:max-w-lg overflow-y-auto rounded-none border-l border-white/5 p-5 shadow-2xl animate-slide-in">
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

          <LeadCustomFieldInputs
            fields={customFields}
            values={form.customFieldValues}
            onChange={(fieldId, value) =>
              setForm((current) => ({
                ...current,
                customFieldValues: { ...current.customFieldValues, [fieldId]: value },
              }))
            }
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

        <section className="mt-8 space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h3 className="font-bold text-white">Mensagens Enviadas</h3>
          </div>

          <div className="space-y-4">
            {messages.filter((m: any) => m.status === "sent").length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500 italic">
                Nenhuma abordagem enviada para este lead ainda.
              </p>
            ) : (
              messages
                .filter((m: any) => m.status === "sent")
                .sort((a: any, b: any) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                .map((msg: any) => {
                  const campaign = campaigns.find(c => c.id === msg.campaign_id);
                  return (
                    <div key={msg.id} className="relative rounded-lg border border-emerald-500/10 bg-slate-900/40 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                            Campanha: {campaign?.name || "Geral"}
                          </span>
                          {msg.is_automated ? (
                            <span className="app-pill border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-[10px]">
                              <Zap className="h-3 w-3" />
                              Automação
                            </span>
                          ) : null}
                          <span className="app-pill border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-[10px]">
                            <CheckCircle2 className="h-3 w-3" />
                            Enviada
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {new Date(msg.sent_at || msg.updated_at).toLocaleString("pt-BR")}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-slate-300">{msg.content}</p>
                      <div className="mt-3 flex justify-end border-t border-slate-800 pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="px-2 py-1 text-[10px] text-emerald-400 hover:bg-emerald-500/10"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            toast.success("Copiado!");
                          }}
                        >
                          Copiar Conteúdo
                        </Button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>

        <section className="mt-8 space-y-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
              <h3 className="font-bold text-white">Mensagens da IA</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw className={`h-4 w-4 ${isLoadingMessages ? "animate-spin" : ""}`} />}
                onClick={() => void refreshMessages()}
                disabled={isLoadingMessages}
                className="text-xs"
                title="Atualizar status das mensagens"
              >
                Atualizar
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Sparkles className="h-4 w-4" />}
                onClick={() => handleGenerateMessages(false)}
                disabled={isGenerating || !form.campaignId}
                className="text-xs"
              >
                {isGenerating ? "Gerando..." : "Gerar 3 mensagens"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
                onClick={() => handleGenerateMessages(true)}
                disabled={isGenerating || !form.campaignId}
                className="text-xs"
                title="Forçar IA a gerar novas opções"
              >
                Regenerar
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {messagesError ? (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
                <div className="flex items-start gap-2 text-red-200">
                  <AlertTriangle className="h-4 w-4 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Não foi possível carregar as mensagens.</p>
                    <p className="mt-0.5 text-xs text-red-200/70 break-words">{messagesError}</p>
                  </div>
                </div>
              </div>
            ) : null}

            {isLoadingMessages && messages.length === 0 ? (
              <div className="h-24 animate-pulse rounded-lg bg-slate-900/40 border border-slate-800/50" />
            ) : null}

            {messages.filter((m: any) => m.status !== "sent").length === 0 && !isLoadingMessages ? (
              <div className="py-5 text-center">
                <p className="text-sm font-medium text-slate-200">Nenhuma mensagem ainda</p>
                <p className="mt-1 text-xs text-slate-500">
                  Selecione uma campanha e clique em <span className="font-medium text-slate-200">Gerar 3 mensagens</span>.
                  Se a etapa tiver automação, você verá o status <span className="font-mono">pending</span> até a IA finalizar.
                </p>
              </div>
            ) : (
              messages
                .filter((m: any) => m.status !== "sent")
                .sort((a: any, b: any) => {
                  const rank: Record<string, number> = { pending: 0, failed: 1, generated: 2 };
                  const ar = rank[String(a?.status)] ?? 99;
                  const br = rank[String(b?.status)] ?? 99;
                  if (ar !== br) return ar - br;
                  const ai = typeof a?.variation_index === "number" ? a.variation_index : 0;
                  const bi = typeof b?.variation_index === "number" ? b.variation_index : 0;
                  if (ai !== bi) return ai - bi;
                  return new Date(b?.created_at ?? b?.updated_at ?? 0).getTime() - new Date(a?.created_at ?? a?.updated_at ?? 0).getTime();
                })
                .map((msg: any) => {
                  const campaign = campaigns.find((c) => c.id === msg.campaign_id);
                  const styles = ["Direto", "Consultivo", "Criativo"];
                  const rawStyle = typeof msg.metadata?.style === "string" ? msg.metadata.style : null;
                  const styleName = rawStyle
                    ? rawStyle.charAt(0).toUpperCase() + rawStyle.slice(1)
                    : styles[msg.variation_index] || "IA";

                  const status = String(msg.status || "generated");
                  const statusUi =
                    status === "pending"
                      ? { label: "Pendente", cls: "border-amber-500/20 bg-amber-500/10 text-amber-200", icon: <Clock className="h-3 w-3" /> }
                      : status === "failed"
                        ? { label: "Falhou", cls: "border-red-500/20 bg-red-500/10 text-red-200", icon: <AlertTriangle className="h-3 w-3" /> }
                        : { label: "Gerada", cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-200", icon: <CheckCircle2 className="h-3 w-3" /> };

                  const canSend = status === "generated" && Boolean(msg.id);
                  const sendTitle =
                    status === "pending"
                      ? "Aguarde a automação concluir."
                      : status === "failed"
                        ? "A IA falhou. Tente regenerar."
                        : !msg.id
                          ? "Recarregue para enviar mensagens recém geradas."
                          : "";

                  return (
                    <div key={msg.id || msg.content} className="group relative rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-indigo-500/40">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 truncate">
                            {campaign?.name ? `Campanha: ${campaign.name}` : "Campanha: Geral"}
                          </span>
                          <span className="text-[10px] text-slate-500">• Estilo: {styleName}</span>
                          {msg.is_automated ? (
                            <span className="app-pill border-indigo-500/30 bg-indigo-500/10 text-indigo-200 text-[10px]">
                              <Zap className="h-3 w-3" />
                              Automação
                            </span>
                          ) : null}
                        </div>

                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${statusUi.cls}`}>
                          {statusUi.icon}
                          {statusUi.label}
                        </span>
                      </div>

                      <p className="text-sm leading-relaxed text-slate-200">{msg.content}</p>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-3">
                        {status === "failed" && msg.campaign_id ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            leftIcon={<RefreshCw className="h-4 w-4" />}
                            disabled={isGenerating}
                            onClick={() => handleGenerateMessages(true, msg.campaign_id)}
                            className="text-xs"
                            title="Gerar novamente para esta campanha"
                          >
                            Tentar novamente
                          </Button>
                        ) : (
                          <span className="text-[10px] text-slate-500">
                            {msg.created_at ? new Date(msg.created_at).toLocaleString("pt-BR") : ""}
                          </span>
                        )}

                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="px-2 py-1 text-[10px]"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(msg.content);
                                toast.success("Copiado!");
                              } catch {
                                toast.error("Não foi possível copiar. Selecione o texto manualmente.");
                              }
                            }}
                          >
                            Copiar
                          </Button>
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            className="px-2 py-1 text-[10px]"
                            disabled={isSending || !canSend}
                            title={sendTitle}
                            onClick={() => handleSend(msg.id)}
                          >
                            {isSending ? "Enviando..." : "Enviar"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </section>
        
        <section className="mt-8 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-700/50 pb-2">
            <History className="h-5 w-5 text-indigo-400" />
            <h3 className="font-bold text-white">Histórico e Atividades</h3>
          </div>
          
          <div className="pt-2">
            <LeadTimeline leadId={lead.id} />
          </div>
        </section>
      </Surface>
    </div>
  );
}
