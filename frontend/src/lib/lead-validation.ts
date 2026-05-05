import type { LeadFormPayload, WorkspaceCustomField } from "../types/database.types";
import { isBlankCustomFieldValue } from "./custom-fields";

export function normalizePhone(phone: string | null) {
  if (!phone) {
    return null;
  }

  const normalized = phone.replace(/[^\d+]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function validateLeadPayload(payload: LeadFormPayload, customFields: WorkspaceCustomField[] = []) {
  if (!payload.name || payload.name.trim().length < 3) {
    return "Informe um nome com pelo menos 3 caracteres.";
  }

  if (!payload.stageId) {
    return "Selecione uma etapa inicial.";
  }

  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) {
    return "Informe um email válido ou deixe em branco.";
  }

  const requiredCustomFields = customFields.filter((field) => field.required && field.is_active);
  for (const field of requiredCustomFields) {
    if (isBlankCustomFieldValue(payload.customFieldValues?.[field.id])) {
      return `Informe ${field.name}.`;
    }
  }

  return null;
}
