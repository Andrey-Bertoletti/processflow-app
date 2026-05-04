"use client";

import { useEffect, useState } from "react";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember } from "@/lib/pipeline";
import { FIELD_LABELS } from "@/lib/pipeline";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { SelectField, TextField } from "@/components/ui/Field";

type StageValidationModalProps = {
  isOpen: boolean;
  lead: Lead;
  targetStage: Stage;
  members: WorkspaceMember[];
  missingFields: string[];
  onClose: () => void;
  onConfirm: (payload: LeadFormPayload) => Promise<void>;
};

export default function StageValidationModal({
  isOpen,
  lead,
  targetStage,
  members,
  missingFields,
  onClose,
  onConfirm,
}: StageValidationModalProps) {
  const [email, setEmail] = useState(lead.email || "");
  const [phone, setPhone] = useState(lead.phone || "");
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to || "");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEmail(lead.email || "");
    setPhone(lead.phone || "");
    setAssignedTo(lead.assigned_to || "");
  }, [lead]);

  if (!isOpen) return null;

  const validate = () => {
    const errors: string[] = [];
    targetStage.required_fields?.forEach(rule => {
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
        name: lead.name,
        email: email || null,
        phone: normalizedPhone || null,
        stageId: targetStage.id,
        assignedTo: assignedTo || null,
      });
    } finally {

      setIsSaving(false);
    }
  };

  const hasRule = (fieldName: string) => 
    targetStage.required_fields?.some(r => r.field === fieldName);

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
          {hasRule("email") && (
            <TextField
              label="E-mail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value.trim().toLowerCase())}
              placeholder="exemplo@email.com"
              required
              autoFocus={true}
            />
          )}

          {hasRule("phone") && (
            <TextField
              label="Telefone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-0000"
              required
              autoFocus={!hasRule("email")}
            />
          )}

          {hasRule("assigned_to") && (
            <SelectField
              label="Atribuir Responsável"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              required
              autoFocus={!hasRule("email") && !hasRule("phone")}
            >

              <option value="">Selecione um membro</option>
              {members.map((member) => (
                <option key={member.id} value={member.userId}>
                  {member.displayName}
                </option>
              ))}
            </SelectField>
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

