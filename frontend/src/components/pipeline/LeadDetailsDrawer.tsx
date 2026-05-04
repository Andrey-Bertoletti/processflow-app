"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember } from "@/lib/pipeline";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  useEffect(() => {
    if (!lead) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(prev => prev === (lead.name || "") ? prev : (lead.name || ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmail(prev => prev === (lead.email || "") ? prev : (lead.email || ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhone(prev => prev === (lead.phone || "") ? prev : (lead.phone || ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStageId(prev => prev === (lead.stage_id || "") ? prev : (lead.stage_id || ""));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAssignedTo(prev => prev === (lead.assigned_to || "") ? prev : (lead.assigned_to || ""));
  }, [lead]);

  if (!isOpen || !lead) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <Surface className="h-full w-full max-w-lg rounded-none border-l-0 p-5">
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
          <p>ID: {lead.id}</p>
          <p>Workspace: {lead.workspace_id}</p>
          <p>Criado em: {lead.created_at ? new Date(lead.created_at).toLocaleString() : "-"}</p>
          <p>Atualizado em: {lead.updated_at ? new Date(lead.updated_at).toLocaleString() : "-"}</p>
        </div>

        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            // Normaliza o telefone
            const normalizedPhone = phone.trim().replace(/\D/g, "");
            
            await onSave({
              name: name.trim(),
              email: email.trim() || null,
              phone: normalizedPhone || null,
              stageId,
              assignedTo: assignedTo || null,
            });
          }}

        >
          <TextField
            label="Nome"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <TextField
            label="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
          />

          <TextField
            label="Telefone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
          />

          <SelectField
            label="Etapa"
            value={stageId}
            onChange={(event) => setStageId(event.target.value)}
            required
          >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name}
                </option>
              ))}
          </SelectField>

          <SelectField
            label="Responsavel"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
              <option value="">Sem responsavel</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.displayName} {member.role ? `(${member.role})` : ""}
                </option>
              ))}
          </SelectField>

          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={isSaving || !name.trim() || !stageId}
              className="flex-1"
            >
              {isSaving ? "Salvando..." : "Salvar Alteracoes"}
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

        <section className="mt-6 rounded-lg border border-dashed border-slate-700 p-4">
          <h3 className="text-sm font-semibold text-white">Historico</h3>
          <p className="mt-2 text-xs text-slate-400">
            Sem mensagens ainda. Este painel sera conectado com a tabela messages na proxima fase.
          </p>
        </section>
      </Surface>
    </div>
  );
}
