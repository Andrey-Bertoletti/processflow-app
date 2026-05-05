"use client";

import { SelectField, TextField } from "@/components/ui/Field";
import { customFieldValueToInputValue, type WorkspaceCustomField } from "@/lib/custom-fields";
import type { Json } from "@/types/database.types";

type LeadCustomFieldInputsProps = {
  fields: WorkspaceCustomField[];
  values: Record<string, Json | null | undefined>;
  onChange: (fieldId: string, value: Json | null) => void;
  className?: string;
};

function getOptions(field: WorkspaceCustomField) {
  return Array.isArray(field.options)
    ? field.options
        .map((option) => (typeof option === "string" || typeof option === "number" ? String(option) : ""))
        .filter(Boolean)
    : [];
}

export default function LeadCustomFieldInputs({ fields, values, onChange, className = "" }: LeadCustomFieldInputsProps) {
  const activeFields = fields.filter((field) => field.is_active);

  if (activeFields.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-4 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 ${className}`.trim()}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campos personalizados</p>
      {activeFields.map((field) => {
        const value = customFieldValueToInputValue(values[field.id]);
        const options = getOptions(field);
        const label = `${field.name}${field.required ? " *" : ""}`;

        if (field.field_type === "select") {
          return (
            <SelectField
              key={field.id}
              label={label}
              value={value}
              onChange={(event) => onChange(field.id, event.target.value || null)}
              required={field.required}
            >
              <option value="">Selecione</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </SelectField>
          );
        }

        return (
          <TextField
            key={field.id}
            label={label}
            type={field.field_type === "number" ? "number" : "text"}
            value={value}
            onChange={(event) => {
              if (field.field_type === "number") {
                onChange(field.id, event.target.value === "" ? null : Number(event.target.value));
                return;
              }

              onChange(field.id, event.target.value || null);
            }}
            required={field.required}
            placeholder={`Preencha ${field.name.toLowerCase()}...`}
          />
        );
      })}
    </div>
  );
}
