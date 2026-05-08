"use client";

import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import RequireWorkspaceAdmin from "@/components/admin/RequireWorkspaceAdmin";
import { SelectField, TextField } from "@/components/ui/Field";
import { Layout, Plus, Trash2, ArrowUp, ArrowDown, Save, RefreshCcw, Settings2, CheckSquare, X } from "lucide-react";
import { toast } from "sonner";
import { normalizeRequiredFieldRules, type RequiredFieldRule } from "@/lib/custom-fields";

interface Stage {
  id: string;
  name: string;
  order: number;
  workspace_id: string;
  auto_campaign_id: string | null;
  required_fields: any[];
}

interface Campaign {
  id: string;
  name: string;
}

interface CustomField {
  id: string;
  name: string;
  is_active: boolean;
}

const BASE_FIELDS = [
  { key: "name", label: "Nome" },
  { key: "email", label: "E-mail" },
  { key: "phone", label: "Telefone" },
  { key: "company", label: "Empresa" },
  { key: "role", label: "Cargo" },
  { key: "source", label: "Origem" },
  { key: "notes", label: "Observações" },
  { key: "assigned_to", label: "Responsável" }
];

export default function PipelineManagementPage() {
  const { activeWorkspaceId } = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  
  // Modal State
  const [editingStage, setEditingStage] = useState<Stage | null>(null);

  const fetchData = async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    try {
      const [stagesRes, campaignsRes, cfRes] = await Promise.all([
        supabase.from("stages").select("*").eq("workspace_id", activeWorkspaceId).order("order", { ascending: true }),
        supabase.from("campaigns").select("id, name").eq("workspace_id", activeWorkspaceId),
        supabase.from("workspace_custom_fields").select("id, name, is_active").eq("workspace_id", activeWorkspaceId)
      ]);

      if (stagesRes.error) throw stagesRes.error;
      if (campaignsRes.error) throw campaignsRes.error;
      if (cfRes.error) throw cfRes.error;

      setStages(stagesRes.data as Stage[]);
      setCampaigns(campaignsRes.data as Campaign[]);
      setCustomFields(cfRes.data as CustomField[]);
    } catch (err: any) {
      console.error("Erro ao carregar dados:", err);
      toast.error("Erro ao carregar configurações do funil.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeWorkspaceId]);

  const handleUpdateStage = async (stageId: string, updates: Partial<Stage>) => {
    setSavingId(stageId);
    try {
      const { error } = await supabase
        .from("stages")
        .update(updates)
        .eq("id", stageId);

      if (error) throw error;
      
      setStages(prev => prev.map(s => s.id === stageId ? { ...s, ...updates } : s));
      toast.success("Etapa atualizada com sucesso.");
    } catch (err: any) {
      console.error("Erro ao atualizar etapa:", err);
      toast.error("Falha ao salvar alterações.");
    } finally {
      setSavingId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const newStages = [...stages];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    
    if (targetIndex < 0 || targetIndex >= newStages.length) return;

    const [removed] = newStages.splice(index, 1);
    newStages.splice(targetIndex, 0, removed);

    const updatedStages = newStages.map((s, i) => ({ ...s, order: i }));
    setStages(updatedStages);

    try {
      for (const s of updatedStages) {
        await supabase.from("stages").update({ order: s.order }).eq("id", s.id);
      }
      toast.success("Ordem do funil atualizada.");
    } catch (err) {
      console.error("Erro ao reordenar:", err);
      toast.error("Erro ao sincronizar ordem com o servidor.");
      fetchData();
    }
  };

  const handleCreateStage = async () => {
    if (!activeWorkspaceId) return;
    const name = prompt("Nome da nova etapa:");
    if (!name) return;

    setLoading(true);
    try {
      const maxOrder = stages.length > 0 ? Math.max(...stages.map(s => s.order)) : -1;
      const { data, error } = await supabase
        .from("stages")
        .insert({
          name,
          order: maxOrder + 1,
          workspace_id: activeWorkspaceId
        })
        .select()
        .single();

      if (error) throw error;
      setStages(prev => [...prev, data as Stage]);
      toast.success("Etapa criada com sucesso.");
    } catch (err) {
      console.error("Erro ao criar etapa:", err);
      toast.error("Falha ao criar nova etapa.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStage = async (stage: Stage) => {
    const { count, error: countErr } = await supabase
      .from("leads")
      .select("*", { count: "exact", head: true })
      .eq("stage_id", stage.id);

    if (countErr) {
      toast.error("Erro ao validar leads na etapa.");
      return;
    }

    if (count && count > 0) {
      if (!confirm(`Aviso: Existem ${count} leads nesta etapa. Se você a excluir, os leads poderão ficar sem etapa vinculada. Continuar?`)) {
        return;
      }
    } else {
      if (!confirm(`Deseja excluir a etapa "${stage.name}"?`)) return;
    }

    setSavingId(stage.id);
    try {
      const { error } = await supabase.from("stages").delete().eq("id", stage.id);
      if (error) throw error;
      setStages(prev => prev.filter(s => s.id !== stage.id));
      toast.success("Etapa removida.");
    } catch (err) {
      console.error("Erro ao deletar:", err);
      toast.error("Falha ao remover etapa.");
    } finally {
      setSavingId(null);
    }
  };

  const toggleRequiredField = (stage: Stage, fieldKey: string, isCustom = false) => {
    const currentRules = normalizeRequiredFieldRules(stage.required_fields);
    const exists = isCustom 
      ? currentRules.some(r => r.custom_field_id === fieldKey)
      : currentRules.some(r => r.field === fieldKey);

    let newRules: RequiredFieldRule[];
    if (exists) {
      newRules = isCustom
        ? currentRules.filter(r => r.custom_field_id !== fieldKey)
        : currentRules.filter(r => r.field !== fieldKey);
    } else {
      const label = isCustom 
        ? customFields.find(cf => cf.id === fieldKey)?.name || "Campo Personalizado"
        : BASE_FIELDS.find(bf => bf.key === fieldKey)?.label || fieldKey;
      
      const newRule: RequiredFieldRule = isCustom
        ? { custom_field_id: fieldKey, label }
        : { field: fieldKey, label };
      
      newRules = [...currentRules, newRule];
    }

    // Update locally
    setStages(prev => prev.map(s => s.id === stage.id ? { ...s, required_fields: newRules } : s));
    if (editingStage?.id === stage.id) {
      setEditingStage(prev => prev ? { ...prev, required_fields: newRules } : null);
    }
    
    // Auto save
    handleUpdateStage(stage.id, { required_fields: newRules });
  };

  return (
    <RequireWorkspaceAdmin>
      <div className="mx-auto max-w-5xl space-y-8 p-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <Layout className="h-6 w-6 text-blue-400" />
              Configuração do Funil
            </h1>
            <p className="text-sm text-zinc-500">
              Personalize as etapas do seu pipeline de vendas e vincule automações de IA.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={fetchData} isLoading={loading} leftIcon={<RefreshCcw className="h-4 w-4" />}>
              Atualizar
            </Button>
            <Button onClick={handleCreateStage} leftIcon={<Plus className="h-4 w-4" />}>
              Nova Etapa
            </Button>
          </div>
        </header>

        <div className="space-y-4">
          {loading && stages.length === 0 ? (
            <div className="py-20 text-center text-zinc-500">Carregando estrutura do funil...</div>
          ) : stages.length === 0 ? (
            <Surface className="py-20 text-center">
              <p className="text-zinc-500">Nenhuma etapa configurada para este workspace.</p>
              <Button variant="secondary" className="mt-4" onClick={handleCreateStage}>Criar Primeira Etapa</Button>
            </Surface>
          ) : (
            stages.map((stage, index) => (
              <Surface key={stage.id} className="p-4 group border-white/5 hover:border-blue-500/20 transition-all">
                <div className="flex flex-wrap items-center gap-6">
                  {/* Order */}
                  <div className="flex flex-col items-center gap-1">
                    <button 
                      onClick={() => handleMove(index, 'up')} 
                      disabled={index === 0}
                      className="p-1 hover:text-white text-zinc-600 disabled:opacity-0 transition-opacity"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-mono font-bold text-zinc-500">{index + 1}</span>
                    <button 
                      onClick={() => handleMove(index, 'down')} 
                      disabled={index === stages.length - 1}
                      className="p-1 hover:text-white text-zinc-600 disabled:opacity-0 transition-opacity"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Name Edit */}
                  <div className="flex-1 min-w-[150px]">
                    <TextField
                      label="Nome da Etapa"
                      value={stage.name}
                      onChange={(e) => setStages(prev => prev.map(s => s.id === stage.id ? { ...s, name: e.target.value } : s))}
                      onBlur={() => handleUpdateStage(stage.id, { name: stage.name })}
                      className="bg-transparent border-transparent hover:border-white/10 focus:bg-zinc-900"
                    />
                  </div>

                  {/* Automation Link */}
                  <div className="flex-1 min-w-[150px]">
                    <SelectField
                      label="Automação IA (Gatilho)"
                      value={stage.auto_campaign_id || ""}
                      onChange={(e) => handleUpdateStage(stage.id, { auto_campaign_id: e.target.value || null })}
                    >
                      <option value="">Sem automação</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </SelectField>
                  </div>

                  {/* Fields Summary */}
                  <div className="flex-1 min-w-[150px]">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 mb-1">Campos Obrigatórios</p>
                    <div className="flex flex-wrap gap-1">
                      {normalizeRequiredFieldRules(stage.required_fields).length === 0 ? (
                        <span className="text-xs text-zinc-600 italic">Nenhum</span>
                      ) : (
                        normalizeRequiredFieldRules(stage.required_fields).slice(0, 3).map((r, i) => (
                          <span key={i} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                            {r.label}
                          </span>
                        ))
                      )}
                      {normalizeRequiredFieldRules(stage.required_fields).length > 3 && (
                        <span className="text-[10px] text-zinc-500">+{normalizeRequiredFieldRules(stage.required_fields).length - 3}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingStage(stage)}
                      className="text-zinc-500 hover:text-blue-400 hover:bg-blue-500/10"
                    >
                      <Settings2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteStage(stage)}
                      disabled={savingId === stage.id}
                      className="text-zinc-600 hover:text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Surface>
            ))
          )}
        </div>

        {/* Required Fields Modal */}
        {editingStage && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <Surface className="w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl border-white/10">
              <header className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/50">
                <div>
                  <h2 className="text-lg font-bold text-white">Campos Obrigatórios: {editingStage.name}</h2>
                  <p className="text-xs text-zinc-500">O lead só poderá entrar nesta etapa se estes campos estiverem preenchidos.</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setEditingStage(null)}>
                  <X className="h-5 w-5" />
                </Button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Base Fields */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4 flex items-center gap-2">
                    <CheckSquare className="h-3 w-3" />
                    Campos Padrão
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {BASE_FIELDS.map(field => {
                      const isSelected = normalizeRequiredFieldRules(editingStage.required_fields).some(r => r.field === field.key);
                      return (
                        <button
                          key={field.key}
                          onClick={() => toggleRequiredField(editingStage, field.key)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs transition-all ${
                            isSelected 
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-400" 
                              : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:border-white/10"
                          }`}
                        >
                          {field.label}
                          {isSelected && <Save className="h-3 w-3" />}
                        </button>
                      );
                    })}
                  </div>
                </section>

                {/* Custom Fields */}
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-purple-400 mb-4 flex items-center gap-2">
                    <CheckSquare className="h-3 w-3" />
                    Campos Personalizados
                  </h3>
                  {customFields.filter(cf => cf.is_active).length === 0 ? (
                    <p className="text-xs text-zinc-600 italic">Nenhum campo personalizado ativo encontrado.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {customFields.filter(cf => cf.is_active).map(field => {
                        const isSelected = normalizeRequiredFieldRules(editingStage.required_fields).some(r => r.custom_field_id === field.id);
                        return (
                          <button
                            key={field.id}
                            onClick={() => toggleRequiredField(editingStage, field.id, true)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-lg border text-xs transition-all ${
                              isSelected 
                                ? "bg-purple-500/10 border-purple-500/30 text-purple-400" 
                                : "bg-zinc-800/30 border-white/5 text-zinc-500 hover:border-white/10"
                            }`}
                          >
                            {field.name}
                            {isSelected && <Save className="h-3 w-3" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <footer className="px-6 py-4 border-t border-white/5 bg-zinc-900/50 flex justify-end">
                <Button onClick={() => setEditingStage(null)}>
                  Concluído
                </Button>
              </footer>
            </Surface>
          </div>
        )}
      </div>
    </RequireWorkspaceAdmin>
  );
}
