"use client";

import { useState } from "react";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember } from "@/types/database.types";
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

function buildInitialForm(lead: Lead | null) {
  return {
    name: lead?.name ?? "",
    email: lead?.email ?? "",
    phone: lead?.phone ?? "",
    stageId: lead?.stage_id ?? "",
    assignedTo: lead?.assigned_to ?? "",
  };
}

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
  const [form, setForm] = useState(() => buildInitialForm(lead));

  if (!isOpen || !lead) {
    return null;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    await onSave({
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      stageId: form.stageId,
      assignedTo: form.assignedTo || null,
      campaignId: lead.campaign_id ?? null,
    });
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

          <div className="flex gap-2">
            <Button type="submit" disabled={isSaving || !form.name.trim() || !form.stageId} className="flex-1">
              {isSaving ? "Salvando..." : "Salvar Alterações"}
            </Button>
            <Button type="button" variant="danger" disabled={isSaving || isDeleting} onClick={onDelete}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </Button>
          </div>
        </form>

        <section className="mt-6 rounded-lg border border-dashed border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-white">Histórico</h3>
          <p className="mt-2 text-xs text-slate-400">
            Sem mensagens ainda. Este painel será conectado com a tabela messages na próxima fase.
          </p>
        </section>
      </Surface>
    </div>
  );
}
