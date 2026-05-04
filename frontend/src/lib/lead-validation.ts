import type { LeadFormPayload } from "@/lib/pipeline";

export function normalizePhone(phone: string | null) {
  if (!phone) {
    return null;
  }

  const normalized = phone.replace(/[^\d+]/g, "").trim();
  return normalized.length > 0 ? normalized : null;
}

export function validateLeadPayload(payload: LeadFormPayload) {
  if (!payload.name || payload.name.trim().length < 3) {
    return "Informe um nome com pelo menos 3 caracteres.";
  }

  if (!payload.stageId) {
    return "Selecione uma etapa inicial.";
  }

  if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) {
    return "Informe um email válido ou deixe em branco.";
  }

  return null;
}
