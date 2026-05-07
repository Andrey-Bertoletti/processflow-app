"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField, SelectField, TextareaField } from "@/components/ui/Field";
import Link from "next/link";
import { ArrowLeft, Check, Edit3, Plus, RefreshCw, Trash2, Settings } from "lucide-react";
import { FIELD_LABELS } from "@/lib/pipeline";
import { normalizeCustomFieldKey, normalizeRequiredFieldRules, parseCustomFieldOptions, type RequiredFieldRule } from "@/lib/custom-fields";
import type { Json, Stage, WorkspaceCustomField } from "@/types/database.types";

type FieldFormState = {
  name: string;
  key: string;
  field_type: string;
  required: boolean;
  is_active: boolean;
  optionsText: string;
};

const EMPTY_FIELD_FORM: FieldFormState = {
  name: "",
  key: "",
  field_type: "text",
  required: false,
  is_active: true,
  optionsText: "",
};

const BASE_REQUIRED_FIELDS = ["name", "email", "phone", "assigned_to", "company", "role", "source", "notes"] as const;

export default function CustomFieldsSettings() {
  const { activeWorkspaceId } = useAuth();
  const [fields, setFields] = useState<WorkspaceCustomField[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingRules, setIsSavingRules] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  const [fieldForm, setFieldForm] = useState<FieldFormState>(EMPTY_FIELD_FORM);
  const [selectedStageId, setSelectedStageId] = useState("");
  const [selectedRequiredBaseFields, setSelectedRequiredBaseFields] = useState<string[]>([]);
  const [selectedRequiredCustomFieldIds, setSelectedRequiredCustomFieldIds] = useState<string[]>([]);

  const customFieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);

  const loadData = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);

    const [{ data: customFieldsData, error: customFieldsError }, { data: stagesData, error: stagesError }] = await Promise.all([
      supabase.from("workspace_custom_fields").select("*").eq("workspace_id", activeWorkspaceId).order("created_at", { ascending: true }),
      supabase.from("stages").select("*").eq("workspace_id", activeWorkspaceId).order("order", { ascending: true }),
    ]);

    if (!customFieldsError) setFields((customFieldsData || []) as WorkspaceCustomField[]);
    if (!stagesError) setStages((stagesData || []) as Stage[]);

    const initialStage = stagesData?.[0];
    if (initialStage) {
      setSelectedStageId((current) => current || initialStage.id);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [activeWorkspaceId]);

  useEffect(() => {
    if (!selectedStageId) {
      return;
    }

    const stage = stages.find((item) => item.id === selectedStageId);
    const rules = normalizeRequiredFieldRules(stage?.required_fields);
    setSelectedRequiredBaseFields(rules.filter((rule) => rule.field).map((rule) => rule.field as string));
    setSelectedRequiredCustomFieldIds(rules.filter((rule) => rule.custom_field_id).map((rule) => rule.custom_field_id as string));
  }, [selectedStageId, stages]);

  const resetFieldForm = () => {
    setEditingFieldId(null);
    setFieldForm(EMPTY_FIELD_FORM);
  };

  const handleFieldSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspaceId || !fieldForm.name.trim() || !fieldForm.key.trim()) return;

    setIsSaving(true);
    const payload = {
      workspace_id: activeWorkspaceId,
      name: fieldForm.name.trim(),
      key: normalizeCustomFieldKey(fieldForm.key),
      field_type: fieldForm.field_type,
      required: fieldForm.required,
      is_active: fieldForm.is_active,
      options: fieldForm.field_type === "select" ? parseCustomFieldOptions(fieldForm.optionsText) : ([] as Json),
    };

    const request = editingFieldId
      ? supabase.from("workspace_custom_fields").update(payload).eq("id", editingFieldId)
      : supabase.from("workspace_custom_fields").insert(payload);

    const { error } = await request;

    if (error) {
      alert("Erro ao adicionar campo: " + error.message);
    } else {
      resetFieldForm();
      await loadData();
    }
    setIsSaving(false);
  };

  const handleDeleteField = async (id: string) => {
    if (!confirm("Tem certeza? Isso nao apagara os dados ja salvos nos leads, mas o campo sumira do formulario.")) return;

    const { error } = await supabase.from("workspace_custom_fields").delete().eq("id", id);
    if (error) alert("Erro ao excluir");
    else await loadData();
  };

  const handleToggleFieldActive = async (field: WorkspaceCustomField) => {
    const { error } = await supabase
      .from("workspace_custom_fields")
      .update({ is_active: !field.is_active })
      .eq("id", field.id);

    if (error) {
      alert("Erro ao atualizar campo: " + error.message);
      return;
    }

    await loadData();
  };

  const handleEditField = (field: WorkspaceCustomField) => {
    setEditingFieldId(field.id);
    setFieldForm({
      name: field.name,
      key: field.key,
      field_type: field.field_type,
      required: field.required,
      is_active: field.is_active,
      optionsText: Array.isArray(field.options) ? field.options.map((option) => String(option)).join("\n") : "",
    });
  };

  const handleStageSave = async () => {
    if (!activeWorkspaceId || !selectedStageId) return;

    const rules: RequiredFieldRule[] = [
      ...selectedRequiredBaseFields.map((field) => ({ field, label: FIELD_LABELS[field] || field })),
      ...selectedRequiredCustomFieldIds
        .map((fieldId) => customFieldsById.get(fieldId))
        .filter((field): field is WorkspaceCustomField => Boolean(field))
        .map((field) => ({ custom_field_id: field.id, label: field.name })),
    ];

    setIsSavingRules(true);
    const { error } = await supabase
      .from("stages")
      .update({ required_fields: rules })
      .eq("id", selectedStageId)
      .eq("workspace_id", activeWorkspaceId);

    setIsSavingRules(false);

    if (error) {
      alert("Erro ao salvar regras: " + error.message);
      return;
    }

    await loadData();
  };

  const toggleSelection = (value: string, current: string[], setCurrent: (next: string[]) => void) => {
    if (current.includes(value)) {
      setCurrent(current.filter((item) => item !== value));
      return;
    }

    setCurrent([...current, value]);
  };

  if (!activeWorkspaceId) return <div className="p-10 text-white text-center">Selecione um workspace primeiro.</div>;

  return (
    <main className="app-shell min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Link href="/auth/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> Voltar ao Dashboard
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-white flex items-center gap-3">
              <Settings className="h-8 w-8 text-indigo-400" /> 
              Configuracoes do Workspace
            </h1>
            <p className="text-slate-400">Gerencie campos personalizados para seus leads.</p>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-8">
            <Surface className="p-6 h-fit border-indigo-500/20 bg-indigo-500/5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus className="h-5 w-5 text-indigo-400" /> {editingFieldId ? "Editar Campo" : "Novo Campo"}
                </h2>
                {editingFieldId ? (
                  <Button type="button" variant="secondary" onClick={resetFieldForm}>
                    Cancelar edição
                  </Button>
                ) : null}
              </div>

              <form onSubmit={handleFieldSubmit} className="space-y-4">
                <TextField
                  label="Nome do Campo"
                  value={fieldForm.name}
                  onChange={(event) => {
                    const nextName = event.target.value;
                    setFieldForm((current) => ({
                      ...current,
                      name: nextName,
                      key: current.key || normalizeCustomFieldKey(nextName),
                    }));
                  }}
                  placeholder="Ex: Segmento"
                  required
                />
                <TextField
                  label="Chave técnica"
                  value={fieldForm.key}
                  onChange={(event) => setFieldForm((current) => ({ ...current, key: event.target.value }))}
                  placeholder="Ex: segmento"
                  required
                />
                <SelectField
                  label="Tipo"
                  value={fieldForm.field_type}
                  onChange={(event) => setFieldForm((current) => ({ ...current, field_type: event.target.value }))}
                >
                  <option value="text">Texto</option>
                  <option value="number">Número</option>
                  <option value="select">Seleção</option>
                </SelectField>
                {fieldForm.field_type === "select" ? (
                  <TextareaField
                    label="Opções"
                    hint="Uma opção por linha ou separadas por vírgula."
                    value={fieldForm.optionsText}
                    onChange={(event) => setFieldForm((current) => ({ ...current, optionsText: event.target.value }))}
                    placeholder="Atacado\nVarejo\nEnterprise"
                    rows={4}
                  />
                ) : null}
                <div className="grid grid-cols-2 gap-3">
                  <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={fieldForm.required}
                      onChange={(event) => setFieldForm((current) => ({ ...current, required: event.target.checked }))}
                    />
                    Obrigatório
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      checked={fieldForm.is_active}
                      onChange={(event) => setFieldForm((current) => ({ ...current, is_active: event.target.checked }))}
                    />
                    Ativo
                  </label>
                </div>

                <Button type="submit" className="w-full" disabled={isSaving}>
                  {isSaving ? "Salvando..." : editingFieldId ? "Atualizar Campo" : "Criar Campo Personalizado"}
                </Button>
              </form>
            </Surface>

            <Surface className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-lg font-bold text-white">Campos do Workspace</h2>
                <Button type="button" variant="secondary" onClick={loadData} leftIcon={<RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />}>
                  Recarregar
                </Button>
              </div>

              {isLoading ? (
                <div className="animate-pulse space-y-3">
                  <div className="h-10 rounded bg-slate-800"></div>
                  <div className="h-10 rounded bg-slate-800"></div>
                </div>
              ) : fields.length === 0 ? (
                <p className="py-10 text-center text-sm italic text-slate-500">Nenhum campo personalizado criado.</p>
              ) : (
                <div className="space-y-3">
                  {fields.map((field) => (
                    <div key={field.id} className="group flex items-center justify-between rounded-lg border border-slate-700 bg-slate-900/50 p-4 transition-all hover:border-slate-500">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-white">{field.name}</p>
                          {!field.is_active ? <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-400">Inativo</span> : null}
                          {field.required ? <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-amber-300">Obrigatório</span> : null}
                        </div>
                        <p className="text-[10px] font-mono text-slate-500">Chave: {field.key} | Tipo: {field.field_type}</p>
                      </div>
                      <div className="flex items-center gap-2 opacity-100 transition-opacity group-hover:opacity-100">
                        <button type="button" onClick={() => handleEditField(field)} className="p-2 text-slate-500 transition-colors hover:text-blue-300" aria-label="Editar campo">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleToggleFieldActive(field)} className="p-2 text-slate-500 transition-colors hover:text-emerald-300" aria-label="Ativar ou desativar campo">
                          <Check className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={() => handleDeleteField(field.id)} className="p-2 text-slate-500 transition-colors hover:text-red-400" aria-label="Remover campo">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>
          </div>

          <Surface className="p-6 h-fit">
            <h2 className="mb-4 text-lg font-bold text-white">Regras por etapa</h2>
            {stages.length === 0 ? (
              <p className="text-sm text-slate-500">Nenhuma etapa disponível neste workspace.</p>
            ) : (
              <div className="space-y-4">
                <SelectField label="Etapa" value={selectedStageId} onChange={(event) => setSelectedStageId(event.target.value)}>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </SelectField>

                <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campos do lead</p>
                  {BASE_REQUIRED_FIELDS.map((field) => (
                    <label key={field} className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                      <span>{FIELD_LABELS[field] || field}</span>
                      <input
                        type="checkbox"
                        checked={selectedRequiredBaseFields.includes(field)}
                        onChange={() => toggleSelection(field, selectedRequiredBaseFields, setSelectedRequiredBaseFields)}
                      />
                    </label>
                  ))}
                </div>

                <div className="space-y-3 rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Campos personalizados</p>
                  {fields.filter((field) => field.is_active).length === 0 ? (
                    <p className="text-sm text-slate-500">Crie um campo personalizado antes de vinculá-lo à etapa.</p>
                  ) : (
                    fields
                      .filter((field) => field.is_active)
                      .map((field) => (
                        <label key={field.id} className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                          <span>{field.name}</span>
                          <input
                            type="checkbox"
                            checked={selectedRequiredCustomFieldIds.includes(field.id)}
                            onChange={() => toggleSelection(field.id, selectedRequiredCustomFieldIds, setSelectedRequiredCustomFieldIds)}
                          />
                        </label>
                      ))
                  )}
                </div>

                <Button type="button" className="w-full" disabled={isSavingRules} onClick={handleStageSave}>
                  {isSavingRules ? "Salvando regras..." : "Salvar regras da etapa"}
                </Button>

                <div className="rounded-lg border border-slate-700/50 bg-slate-900/50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Regras atuais</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {normalizeRequiredFieldRules(stages.find((stage) => stage.id === selectedStageId)?.required_fields).length === 0 ? (
                      <span className="text-sm text-slate-500">Nenhuma regra configurada.</span>
                    ) : (
                      normalizeRequiredFieldRules(stages.find((stage) => stage.id === selectedStageId)?.required_fields).map((rule, index) => (
                        <span key={`${rule.field || rule.custom_field_id || index}`} className="rounded-full border border-slate-700 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-300">
                          {rule.custom_field_id
                            ? customFieldsById.get(rule.custom_field_id)?.name || rule.label || rule.custom_field_id
                            : FIELD_LABELS[rule.field || ""] || rule.label || rule.field}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </Surface>
        </div>
      </div>
    </main>
  );
}
