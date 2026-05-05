import type { Json, Lead, LeadCustomFieldValue, WorkspaceCustomField } from "@/types/database.types";

export type RequiredFieldRule = {
  field?: string;
  custom_field_id?: string;
  label?: string;
};

export type LeadWithCustomFieldValues = Lead & {
  lead_custom_field_values?: LeadCustomFieldValue[];
};

export const CUSTOM_FIELD_TYPES = ["text", "number", "select"] as const;

export function normalizeCustomFieldKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function parseCustomFieldOptions(value: string) {
  return value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeRequiredFieldRules(value: unknown): RequiredFieldRule[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (typeof item === "string") {
        return { field: item } satisfies RequiredFieldRule;
      }

      if (!item || typeof item !== "object") {
        return null;
      }

      const rule = item as Record<string, unknown>;
      const field = typeof rule.field === "string" ? rule.field : undefined;
      const customFieldId = typeof rule.custom_field_id === "string" ? rule.custom_field_id : undefined;
      const label = typeof rule.label === "string" ? rule.label : undefined;

      if (!field && !customFieldId) {
        return null;
      }

      return { field, custom_field_id: customFieldId, label } satisfies RequiredFieldRule;
    })
    .filter((item): item is RequiredFieldRule => Boolean(item));
}

export function buildCustomFieldValueMap(values: LeadCustomFieldValue[] | null | undefined) {
  return (values || []).reduce<Record<string, Json>>((accumulator, entry) => {
    accumulator[entry.custom_field_id] = entry.value;
    return accumulator;
  }, {});
}

export function isBlankCustomFieldValue(value: Json | null | undefined) {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  if (typeof value === "object") {
    return Object.keys(value).length === 0;
  }

  return false;
}

export function customFieldValueToInputValue(value: Json | null | undefined) {
  if (isBlankCustomFieldValue(value)) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return String(value);
}

export function serializeCustomFieldInputValue(field: WorkspaceCustomField, value: string | number | boolean | null | undefined): Json | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (field.field_type === "number") {
      const parsed = Number(trimmed.replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }

    return trimmed;
  }

  if (field.field_type === "number") {
    return Number.isFinite(value) ? value : null;
  }

  return value;
}

export function buildCustomFieldMetadata(
  values: Record<string, string | number | boolean | null | undefined> | undefined,
) {
  return Object.entries(values || {}).reduce<Record<string, Json>>((accumulator, [key, value]) => {
    if (isBlankCustomFieldValue(value as Json | null | undefined)) {
      return accumulator;
    }

    accumulator[key] = value as Json;
    return accumulator;
  }, {});
}

export function buildLeadCustomFieldValuesDraft(
  lead: LeadWithCustomFieldValues | null,
  fields: WorkspaceCustomField[],
) {
  const leadValueMap = buildCustomFieldValueMap(lead?.lead_custom_field_values);
  const metadata = lead?.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
    ? (lead.metadata as Record<string, Json>)
    : {};

  return fields
    .filter((field) => field.is_active)
    .reduce<Record<string, Json | null>>((accumulator, field) => {
      const value = leadValueMap[field.id] ?? metadata[field.id] ?? metadata[field.key];
      accumulator[field.id] = isBlankCustomFieldValue(value) ? null : value;
      return accumulator;
    }, {});
}

export function getCustomFieldLabel(field: WorkspaceCustomField) {
  return field.name || field.key;
}

export function getRequiredRuleLabel(rule: RequiredFieldRule, customFields: WorkspaceCustomField[]) {
  if (rule.custom_field_id) {
    return customFields.find((field) => field.id === rule.custom_field_id)?.name || rule.label || rule.custom_field_id;
  }

  return rule.label || rule.field || "Campo obrigatório";
}
