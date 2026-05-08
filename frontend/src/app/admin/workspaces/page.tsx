"use client";

import React, { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Building2, ChevronRight, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { TextField } from "@/components/ui/Field";
import { fetchWorkspaces, createWorkspace, updateWorkspace, deleteWorkspace, Workspace } from "@/lib/workspace";
import { toast } from "sonner";

export default function WorkspacesPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadWorkspaces();
  }, []);

  async function loadWorkspaces() {
    try {
      setLoading(true);
      const data = await fetchWorkspaces();
      setWorkspaces(data);
    } catch (error: any) {
      toast.error("Erro ao carregar workspaces: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenCreate() {
    setEditingWorkspace(null);
    setName("");
    setIsModalOpen(true);
  }

  function handleOpenEdit(workspace: Workspace) {
    setEditingWorkspace(workspace);
    setName(workspace.name);
    setIsModalOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) return toast.error("O nome é obrigatório");
    
    try {
      setIsSaving(true);
      if (editingWorkspace) {
        await updateWorkspace(editingWorkspace.id, name);
        toast.success("Workspace atualizado!");
      } else {
        await createWorkspace(name);
        toast.success("Workspace criado!");
      }
      setIsModalOpen(false);
      loadWorkspaces();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Tem certeza que deseja excluir este workspace? Todos os dados vinculados serão perdidos.")) return;

    try {
      await deleteWorkspace(id);
      toast.success("Workspace excluído!");
      loadWorkspaces();
    } catch (error: any) {
      toast.error("Erro ao excluir: " + error.message);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Workspaces</h1>
          <p className="text-slate-500 mt-1">Gerencie seus espaços de trabalho e equipes.</p>
        </div>
        <Button onClick={handleOpenCreate} className="flex items-center gap-2">
          <Plus size={18} />
          Novo Workspace
        </Button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
          <p className="text-slate-400">Carregando seus espaços...</p>
        </div>
      ) : workspaces.length === 0 ? (
        <Surface className="flex flex-col items-center justify-center py-20 border-dashed">
          <Building2 size={48} className="text-slate-300 mb-4" />
          <p className="text-slate-500 text-lg">Nenhum workspace encontrado.</p>
          <Button variant="secondary" onClick={handleOpenCreate} className="mt-4">
            Comece criando o primeiro
          </Button>
        </Surface>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {workspaces.map((ws) => (
            <Surface key={ws.id} className="group hover:border-blue-200 transition-all duration-200 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                  <Building2 size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 text-lg">{ws.name}</h3>
                  <p className="text-xs text-slate-400 font-mono">{ws.id.split('-')[0]}...</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handleOpenEdit(ws)}
                  className="h-9 w-9 p-0"
                >
                  <Edit2 size={16} />
                </Button>
                <Button 
                  variant="secondary" 
                  size="sm" 
                  onClick={() => handleDelete(ws.id)}
                  className="h-9 w-9 p-0 text-red-400 hover:bg-red-500/10"
                >
                  <Trash2 size={16} />
                </Button>
                <ChevronRight size={20} className="text-slate-300 ml-2" />
              </div>
            </Surface>
          ))}
        </div>
      )}

      {/* Modal Simples */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <Surface className="w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-200">
            <h2 className="text-2xl font-bold text-white mb-6">
              {editingWorkspace ? "Editar Workspace" : "Novo Workspace"}
            </h2>
            
            <div className="space-y-6">
              <TextField
                label="Nome do Workspace"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Marketing Digital, Vendas Internas..."
                autoFocus
              />

              <div className="flex items-center gap-3 pt-4">
                <Button 
                  variant="secondary" 
                  className="flex-1" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  Cancelar
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            </div>
          </Surface>
        </div>
      )}
    </div>
  );
}
