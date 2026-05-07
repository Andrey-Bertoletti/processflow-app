"use client";

import { useEffect, useState } from "react";
import type { Json, LeadFormPayload, Stage, WorkspaceMember, WorkspaceCustomField } from "@/types/database.types";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField, TextareaField } from "@/components/ui/Field";
import LeadCustomFieldInputs from "@/components/custom-fields/LeadCustomFieldInputs";
import { buildLeadCustomFieldValuesDraft, normalizeRequiredFieldRules, type LeadWithCustomFieldValues } from "@/lib/custom-fields";

type StageValidationModalProps = {
  isOpen: boolean;
  lead: LeadWithCustomFieldValues;
  targetStage: Stage;
  members: WorkspaceMember[];
  customFields: WorkspaceCustomField[];
  missingFields: string[];
  onClose: () => void;
  onConfirm: (payload: LeadFormPayload) => Promise<void>;
};

export default function StageValidationModal({
  isOpen,
  lead,
  targetStage,
  members,
  customFields,
  missingFields,
  onClose,
  onConfirm,
}: StageValidationModalProps) {
  const [name, setName] = useState(lead.name || "");
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [company, setCompany] = useState(lead.company || "");
  const [role, setRole] = useState(lead.role || "");
  const [source, setSource] = useState(lead.source || "");
  const [notes, setNotes] = useState(lead.notes || "");
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to || "");
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, Json | null>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setName(lead.name || "");
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setCompany(lead.company || "");
    setRole(lead.role || "");
    setSource(lead.source || "");
    setNotes(lead.notes || "");
    setAssignedTo(lead.assigned_to || "");
    setCustomFieldValues(buildLeadCustomFieldValuesDraft(lead, customFields));
  }, [lead, customFields]);

  if (!isOpen) return null;

  const requiredRules = normalizeRequiredFieldRules(targetStage.required_fields);
  const requiredBaseRules = requiredRules.filter((rule) => Boolean(rule.field));
  const requiredCustomFieldIds = requiredRules
    .filter((rule) => Boolean(rule.custom_field_id))
    .map((rule) => rule.custom_field_id as string);

  const requiredCustomFields = customFields.filter((field) => requiredCustomFieldIds.includes(field.id) && field.is_active);

  const validate = () => {
    const errors: string[] = [];
    requiredBaseRules.forEach((rule) => {
      if (rule.field === "email" && email && !email.includes("@")) {
        errors.push("Email inválido");
      }
      if (rule.field === "phone" && phone && phone.length < 10) {
        errors.push("Telefone muito curto");
      }
    });
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const errors = validate();
    if (errors.length > 0) {
      alert(errors.join("\n"));
      return;
    }

    setIsSaving(true);
    try {
      // Normaliza o telefone removendo caracteres não numéricos
      const normalizedPhone = phone.replace(/\D/g, "");

      await onConfirm({
        name: name.trim() || lead.name,
        email: email.trim() || null,
        phone: normalizedPhone || null,
        company: company.trim() || null,
        role: role.trim() || null,
        source: source.trim() || null,
        notes: notes.trim() || null,
        stageId: targetStage.id,
        assignedTo: assignedTo || null,
        campaignId: lead.campaign_id || null,
        customFieldValues,
      });
    } finally {

      setIsSaving(false);
    }
  };

  const hasRule = (fieldName: string) => 
    (targetStage.required_fields as any[])?.some(r => r.field === fieldName);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4">
      <Surface className="w-full max-w-md p-6 shadow-2xl">
        <div className="mb-4">
          <span className="app-pill bg-amber-500/10 text-amber-500 border-amber-500/20 mb-2">Ação Bloqueada</span>
          <h2 className="text-xl font-bold text-white">Dados Obrigatórios Faltando</h2>
          <p className="mt-2 text-sm text-slate-400">
            Para mover o lead para a etapa <span className="font-semibold text-white">"{targetStage.name}"</span>, 
            você precisa preencher as seguintes informações:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {missingFields.map(field => (
              <span key={field} className="text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-300 px-2 py-1 rounded">
                {field}
              </span>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {hasRule("name") && (
            <TextField
              label="Nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome do lead"
              required
              autoFocus={true}
            />
          )}
          {hasRule("email") && (
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              placeholder="exemplo@email.com"
              required
              autoFocus={!hasRule("name")}
            />
          )}

          {hasRule("phone") && (
            <TextField
              label="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-0000"
              required
              autoFocus={!hasRule("name") && !hasRule("email")}
            />
          )}

          {hasRule("assigned_to") && (
            <SelectField
              label="Atribuir Responsável"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
              autoFocus={!hasRule("name") && !hasRule("email") && !hasRule("phone")}
            >

              <option value="">Selecione um membro</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </SelectField>
          )}

          {hasRule("company") && (
            <TextField
              label="Empresa"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Nome da empresa"
              required
            />
          )}

          {hasRule("role") && (
            <TextField
              label="Cargo"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Ex: CEO"
              required
            />
          )}

          {hasRule("source") && (
            <TextField
              label="Origem"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Ex: LinkedIn, Indicação..."
              required
            />
          )}

          {hasRule("notes") && (
            <TextareaField
              label="Observações"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas sobre o lead..."
              rows={3}
              required
            />
          )}

          {requiredCustomFields.length > 0 && (
            <LeadCustomFieldInputs
              fields={requiredCustomFields}
              values={customFieldValues}
              onChange={(fieldId, value) => setCustomFieldValues((current) => ({ ...current, [fieldId]: value }))}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="flex-1">
              {isSaving ? "Salvando..." : "Salvar e Mover"}
            </Button>
          </div>
        </form>
      </Surface>
    </div>
  );
}

