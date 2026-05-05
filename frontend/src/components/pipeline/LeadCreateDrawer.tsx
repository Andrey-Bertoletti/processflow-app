"use client";

import { useEffect, useState } from "react";
import type { LeadFormPayload, Stage, WorkspaceMember, WorkspaceCustomField } from "@/types/database.types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";
import LeadCustomFieldInputs from "@/components/custom-fields/LeadCustomFieldInputs";
import type { Json } from "@/types/database.types";
import { buildCustomFieldMetadata } from "@/lib/custom-fields";

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
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm">
      <Surface className="h-full w-full max-w-md rounded-none border-l-0 p-5">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Novo Lead</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Fechar
          </Button>
        </div>

        <form
          className="space-y-4"
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
              stageId,
              assignedTo: assignedTo || null,
              campaignId: null,
              customFieldValues: buildCustomFieldMetadata(customFieldValues),
            });
          }}

        >
          <TextField
            label="Nome do Lead/Processo"
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
            label="Origem do Lead"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            placeholder="Ex: LinkedIn, Indicação..."
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
            label="Atribuir Responsavel"
            value={assignedTo}
            onChange={(event) => setAssignedTo(event.target.value)}
          >
              <option value="">Sem responsavel</option>
              {members.map((member: WorkspaceMember) => (
                <option key={member.id} value={member.userId}>
                  {member.displayName} {member.role ? `(${member.role})` : ""}
                </option>
              ))}
          </SelectField>

          <Button
            type="submit"
            disabled={isSaving || !stageId || !name.trim()}
            className="w-full"
          >
            {isSaving ? "Salvando..." : "Salvar Lead"}
          </Button>
        </form>
      </Surface>
    </div>
  );
}
