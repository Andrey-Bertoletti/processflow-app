"use client";

import { useEffect, useState } from "react";
import type { LeadFormPayload, Stage, WorkspaceMember, WorkspaceCustomField } from "@/types/database.types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField, TextareaField } from "@/components/ui/Field";
import LeadCustomFieldInputs from "@/components/custom-fields/LeadCustomFieldInputs";
import type { Json } from "@/types/database.types";
import { buildCustomFieldMetadata } from "@/lib/custom-fields";
import { X } from "lucide-react";

type LeadCreateDrawerProps = {
  isOpen: boolean;
  isSaving: boolean;
  stages: Stage[];
  members: WorkspaceMember[];
  customFields: WorkspaceCustomField[];
  defaultStageId: string | null;
  onClose: () => void;
  onSubmit: (payload: LeadFormPayload) => Promise<void>;
};

export default function LeadCreateDrawer({
  isOpen,
  isSaving,
  stages,
  members,
  customFields,
  defaultStageId,
  onClose,
  onSubmit,
}: LeadCreateDrawerProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [stageId, setStageId] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, Json | null>>({});

  useEffect(() => {
    if (!isOpen) return;

    setName("");
    setEmail("");
    setPhone("");
    setAssignedTo("");
    setCompany("");
    setRole("");
    setSource("");
    setNotes("");
    setCustomFieldValues(
      customFields.reduce<Record<string, Json | null>>((accumulator, field) => {
        if (field.is_active) {
          accumulator[field.id] = null;
        }
        return accumulator;
      }, {}),
    );

    const initialStageId = defaultStageId || (stages[0]?.id) || "";
    setStageId(prev => prev === initialStageId ? prev : initialStageId);
  }, [isOpen, stages, defaultStageId, customFields]);


  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <Surface
        elevation="overlay"
        className="relative z-10 h-full w-full max-w-md rounded-none border-l border-zinc-800/50 p-6 animate-slide-in overflow-y-auto"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-white">Novo Lead</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form
          className="space-y-5"
          onSubmit={async (event) => {
            event.preventDefault();
            // Normaliza o telefone antes de enviar
            const normalizedPhone = phone.trim().replace(/\D/g, "");
            
            await onSubmit({
              name: name.trim(),
              email: email.trim() || null,
              phone: normalizedPhone || null,
              company: company.trim() || null,
              role: role.trim() || null,
              source: source.trim() || null,
              notes: notes.trim() || null,
              stageId,
              assignedTo: assignedTo || null,
              campaignId: null,
              customFieldValues: buildCustomFieldMetadata(customFieldValues),
            });
          }}

        >
          <TextField
            label="Nome do Lead"
            placeholder="Ex: Empresa Orion"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            minLength={3}
          />

          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="contato@empresa.com"
          />

          <TextField
            label="Telefone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(11) 99999-0000"
          />

          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Empresa"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              placeholder="Nome da empresa"
            />
            <TextField
              label="Cargo"
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Ex: CEO"
            />
          </div>

          <TextField
            label="Origem"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Ex: LinkedIn, Indicação..."
          />

          <TextareaField
            label="Observações"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Notas sobre o lead..."
            rows={3}
          />

          <LeadCustomFieldInputs
            fields={customFields}
            values={customFieldValues}
            onChange={(fieldId, value) => setCustomFieldValues((current) => ({ ...current, [fieldId]: value }))}
          />

          <SelectField
            label="Etapa Inicial"
            value={stageId}
            onChange={(event) => setStageId(event.target.value)}
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
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
              <option value="">Sem responsável</option>
              {members.map((member: WorkspaceMember) => (
                <option key={member.id} value={member.userId}>
                  {member.displayName} {member.role ? `(${member.role})` : ""}
                </option>
              ))}
          </SelectField>

          <Button
            type="submit"
            disabled={isSaving || !stageId || !name.trim()}
            isLoading={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? "Salvando..." : "Criar Lead"}
          </Button>
        </form>
      </Surface>
    </div>
  );
}
