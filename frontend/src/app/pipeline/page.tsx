"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/app/context/AuthContext";
import { supabase } from "@/lib/supabase/client";

import KanbanBoard from "@/components/pipeline/KanbanBoard";
import LeadCreateDrawer from "@/components/pipeline/LeadCreateDrawer";
import LeadDetailsDrawer from "@/components/pipeline/LeadDetailsDrawer";
import Button from "@/components/ui/Button";
import Surface from "@/components/ui/Surface";
import { createLeadInWorkspace, deleteLeadInWorkspace, updateLeadInWorkspace, validateLeadPayload } from "@/lib/leads";
import { fetchPipelineData, moveLeadToStagePlaceholder, validateLeadMovement, type StageWithLeads } from "@/lib/pipeline";
import type { Lead, LeadFormPayload, Stage, WorkspaceMember } from "@/types/database.types";
import { fetchWorkspaceMembers } from "@/lib/workspace";
import StageValidationModal from "@/components/pipeline/StageValidationModal";

function PipelineSkeleton() {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex min-w-max gap-4">
        {[1, 2, 3, 4].map((column) => (
          <Surface key={column} className="h-full min-h-[520px] w-[300px] shrink-0 p-3">
            <div className="mb-3 h-6 w-2/3 animate-pulse rounded bg-slate-700/80" />
            <div className="space-y-3">
              {[1, 2, 3].map((card) => (
                <div key={card} className="h-16 animate-pulse rounded-lg bg-slate-800/80" />
              ))}
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { user, loading, activeWorkspaceId } = useAuth();
  const [stages, setStages] = useState<StageWithLeads[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingCreate, setIsSavingCreate] = useState(false);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const [isDeletingLead, setIsDeletingLead] = useState(false);
  const [isSavingMove, setIsSavingMove] = useState(false);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    lead: Lead;
    targetStage: Stage;
    missingFields: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const stageList = useMemo<Stage[]>(
    () =>
      stages.map((stage) => ({
        id: stage.id,
        name: stage.name,
        order: stage.order,
        workspace_id: stage.workspace_id,
        required_fields: stage.required_fields,
        auto_campaign_id: stage.auto_campaign_id,
        created_at: stage.created_at,
        updated_at: stage.updated_at,
      })),
    [stages]
  );

  const selectedLead = useMemo<Lead | null>(() => {
    if (!selectedLeadId) {
      return null;
    }

    return stages.flatMap((stage) => stage.leads).find((lead: Lead) => lead.id === selectedLeadId) || null;
  }, [selectedLeadId, stages]);

  const updateLeadInState = (updatedLead: Lead) => {
    setStages((currentStages) => {
      const withoutLead = currentStages.map((stage) => ({
        ...stage,
        leads: stage.leads.filter((lead: Lead) => lead.id !== updatedLead.id),
      }));

      return withoutLead.map((stage) =>
        stage.id === updatedLead.stage_id
          ? {
              ...stage,
              leads: [updatedLead, ...stage.leads],
            }
          : stage
      );
    });
  };

  const removeLeadFromState = (leadId: string) => {
    setStages((currentStages) =>
      currentStages.map((stage: StageWithLeads) => ({
        ...stage,
        leads: stage.leads.filter((lead: Lead) => lead.id !== leadId),
      }))
    );
  };

  const loadPipeline = async () => {
    if (!activeWorkspaceId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [pipelineData, memberData] = await Promise.all([
        fetchPipelineData(activeWorkspaceId),
        fetchWorkspaceMembers(activeWorkspaceId),
      ]);

      setStages(pipelineData);
      setMembers(memberData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao carregar o funil";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInitializePipeline = async () => {
    if (!activeWorkspaceId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { error: seedError } = await supabase.rpc("seed_workspace_pipeline", {
        p_workspace_id: activeWorkspaceId,
        p_with_demo_leads: true,
      });

      if (seedError) throw new Error(seedError.message);
      
      await loadPipeline();
      setSuccessMessage("Funil inicializado com sucesso!");
    } catch (err) {
      console.error("[PIPELINE_INIT_ERROR]", err);
      const message = err instanceof Error ? err.message : "Erro ao inicializar funil";
      setError(message);
      alert(`Erro ao inicializar: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };


  const moveLeadOptimistically = async (leadId: string, targetStageId: string) => {
    if (!activeWorkspaceId) {
      return;
    }

    // Busca o lead e a etapa de destino para validação
    const lead = stages.flatMap((s: StageWithLeads) => s.leads).find((l: Lead) => l.id === leadId);
    const targetStage = stages.find((s: StageWithLeads) => s.id === targetStageId);

    if (lead && targetStage) {
      const missingFields = validateLeadMovement(lead, targetStage);
      if (missingFields.length > 0) {
        setPendingMove({ lead, targetStage, missingFields });
        return; // Bloqueia o movimento e abre o modal
      }
    }

    const previousStages = stages;
    let movedLead: Lead | null = null;

    const optimisticStages = stages.map((stage: StageWithLeads) => {
      const found = stage.leads.find((lead: Lead) => lead.id === leadId);

      if (!found) {
        return stage;
      }

      movedLead = { ...found, stage_id: targetStageId };

      return {
        ...stage,
        leads: stage.leads.filter((lead: Lead) => lead.id !== leadId),
      };
    });

    if (!movedLead) {
      return;
    }

    setStages(
      optimisticStages.map((stage: StageWithLeads) =>
        stage.id === targetStageId
          ? {
              ...stage,
              leads: [movedLead as Lead, ...stage.leads],
            }
          : stage
      )
    );
    setIsSavingMove(true);

    try {
      await moveLeadToStagePlaceholder({ workspaceId: activeWorkspaceId, leadId, targetStageId });
      setSuccessMessage("Lead movido com sucesso!");
    } catch (err) {
      console.error("[PIPELINE_MOVE_ERROR]", err);
      setStages(previousStages);
      const message = err instanceof Error ? err.message : "Erro ao mover lead";
      setError(message);
      alert(`Não foi possível mover o lead: ${message}`);
    } finally {
      setIsSavingMove(false);
    }
  };

  const handleCreateLead = async (payload: LeadFormPayload) => {
    if (!activeWorkspaceId) {
      return;
    }

    const validationError = validateLeadPayload(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingCreate(true);
    setError(null);

    try {
      const createdLead = await createLeadInWorkspace({ workspaceId: activeWorkspaceId, payload });
      updateLeadInState(createdLead);
      setIsCreateDrawerOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao criar lead";
      setError(message);
      alert(`Erro ao criar lead: ${message}`);
    } finally {
      setIsSavingCreate(false);
    }
  };

  const handleUpdateLead = async (payload: LeadFormPayload) => {
    if (!activeWorkspaceId || !selectedLead) {
      return;
    }

    const validationError = validateLeadPayload(payload);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSavingDetails(true);
    setError(null);


    try {
      const updatedLead = await updateLeadInWorkspace({
        workspaceId: activeWorkspaceId,
        leadId: selectedLead.id,
        payload,
        expectedUpdatedAt: selectedLead.updated_at,
      });

      updateLeadInState(updatedLead);
      setSelectedLeadId(updatedLead.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao atualizar lead";
      setError(message);
      alert(`Erro ao atualizar lead: ${message}`);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleDeleteLead = async () => {
    if (!activeWorkspaceId || !selectedLead) {
      return;
    }

    const confirmed = window.confirm(`Excluir o lead ${selectedLead.name}?`);
    if (!confirmed) {
      return;
    }

    setIsDeletingLead(true);
    setError(null);

    try {
      await deleteLeadInWorkspace({ workspaceId: activeWorkspaceId, leadId: selectedLead.id });
      removeLeadFromState(selectedLead.id);
      setSelectedLeadId(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao excluir lead";
      setError(message);
      alert(`Erro ao excluir lead: ${message}`);
    } finally {
      setIsDeletingLead(false);
    }
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  useEffect(() => {
    if (!loading && user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadPipeline();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, activeWorkspaceId]);

  if (loading || isLoading) {
    return (
      <main className="app-shell min-h-screen px-4 py-6">
        <div className="mx-auto max-w-7xl">
          <Surface className="mb-5 p-4">
            <h1 className="text-2xl font-bold text-white">Funil de Leads</h1>
          </Surface>
          <PipelineSkeleton />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4">
        <p className="text-red-300">Nao autorizado</p>
      </main>
    );
  }

  if (!activeWorkspaceId) {
    return (
      <main className="app-shell flex min-h-screen items-center justify-center px-4 py-6">
        <Surface className="w-full max-w-lg p-8 text-center">
          <h1 className="text-2xl font-bold text-white">Selecione um workspace</h1>
          <p className="mt-2 text-sm text-slate-400">
            Escolha um workspace no dashboard para visualizar o Kanban.
          </p>
          <Link href="/auth/dashboard" className="app-button app-button-primary mt-6">
            Ir para dashboard
          </Link>
        </Surface>
      </main>
    );
  }

  return (
    <main className="app-shell min-h-screen px-4 py-6">
      <div className="mx-auto max-w-7xl">
        <Surface className="mb-5 flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <span className="app-pill mb-3">Pipeline</span>
            <h1 className="text-2xl font-bold text-white">Funil de Leads</h1>
            <p className="text-sm text-slate-400">Workspace ativo: {activeWorkspaceId}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => setIsCreateDrawerOpen(true)}>
              Novo Lead
            </Button>
            <Button variant="secondary" onClick={loadPipeline} disabled={isSavingMove || isSavingCreate || isSavingDetails || isDeletingLead}>
              Recarregar
            </Button>
            <Link href="/auth/dashboard" className="app-button app-button-secondary">
              Dashboard
            </Link>
            {isSavingMove && <span className="app-pill border-amber-500/30 bg-amber-500/10 text-amber-200">Movendo...</span>}
          </div>
        </Surface>

        {error ? <Surface className="mb-4 border border-red-500/25 bg-red-500/10 p-4 text-red-200">{error}</Surface> : null}
        {successMessage ? (
          <div className="fixed bottom-6 right-6 z-[100] animate-bounce">
            <Surface className="border-green-500/30 bg-green-500/20 px-6 py-3 text-green-200 shadow-2xl">
              ✓ {successMessage}
            </Surface>
          </div>
        ) : null}


        {stages.length === 0 ? (
          <Surface className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Funil Vazio</h2>
            <p className="mt-2 text-slate-400">
              Este workspace ainda não possui estágios configurados.
            </p>
            <Button 
              variant="primary" 
              className="mt-6" 
              onClick={handleInitializePipeline}
              disabled={isLoading}
            >
              {isLoading ? "Inicializando..." : "Inicializar Etapas Padrão"}
            </Button>
          </Surface>
        ) : (

          <KanbanBoard
            stages={stages}
            onDropLeadPlaceholder={moveLeadOptimistically}
            onLeadClick={(leadId) => setSelectedLeadId(leadId)}
          />
        )}
      </div>

      <LeadCreateDrawer
        isOpen={isCreateDrawerOpen}
        isSaving={isSavingCreate}
        stages={stageList}
        members={members}
        defaultStageId={stageList[0]?.id || null}
        onClose={() => setIsCreateDrawerOpen(false)}
        onSubmit={handleCreateLead}
      />

      <LeadDetailsDrawer
        lead={selectedLead}
        isOpen={Boolean(selectedLead)}
        isSaving={isSavingDetails || isDeletingLead}
        stages={stageList}
        members={members}
        onClose={() => setSelectedLeadId(null)}
        onSave={handleUpdateLead}
        onDelete={handleDeleteLead}
        isDeleting={isDeletingLead}
      />

      {pendingMove && (
        <StageValidationModal
          isOpen={true}
          lead={pendingMove.lead}
          targetStage={pendingMove.targetStage}
          members={members}
          missingFields={pendingMove.missingFields}
          onClose={() => setPendingMove(null)}
          onConfirm={async (payload) => {
            if (!activeWorkspaceId) return;
            try {
              const updatedLead = await updateLeadInWorkspace({
                workspaceId: activeWorkspaceId,
                leadId: pendingMove.lead.id,
                payload,
              });
              updateLeadInState(updatedLead);
              setPendingMove(null);
              setSuccessMessage("Dados atualizados e lead movido!");
            } catch (err) {
              console.error("[PIPELINE_VALIDATION_SAVE_ERROR]", err);
              const message = err instanceof Error ? err.message : "Erro ao completar dados";
              setError(message);
              alert(`Erro ao completar dados: ${message}`);
            }


          }}
        />
      )}
    </main>
  );
}
