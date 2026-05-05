-- Migration: Standardize Pipeline Stages based on Edital
-- This migration is idempotent and safe for existing data.

-- GARANTIR CONSTRAINT PARA O ON CONFLICT FUNCIONAR
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_stage_name_per_workspace') THEN
        ALTER TABLE public.stages ADD CONSTRAINT unique_stage_name_per_workspace UNIQUE (workspace_id, name);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.seed_workspace_pipeline(
    p_workspace_id UUID,
    p_with_demo_leads BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_base_id UUID;
    v_contact_id UUID;
    v_stage_names TEXT[] := ARRAY[
        'Base', 
        'Lead Mapeado', 
        'Tentando Contato', 
        'Conexão Iniciada', 
        'Desqualificado', 
        'Qualificado', 
        'Reunião Agendada'
    ];
    v_name TEXT;
    v_order INT := 10;
BEGIN
    -- 1. Criar Etapas (idempotente)
    FOREACH v_name IN ARRAY v_stage_names LOOP
        INSERT INTO public.stages (workspace_id, name, "order")
        VALUES (p_workspace_id, v_name, v_order)
        ON CONFLICT (workspace_id, name) DO UPDATE 
        SET "order" = v_order; -- Atualiza a ordem se ja existir
        
        v_order := v_order + 10;
    END LOOP;

    -- 2. Pegar IDs para os leads demo se solicitado
    IF p_with_demo_leads THEN
        SELECT id INTO v_base_id FROM public.stages WHERE workspace_id = p_workspace_id AND name = 'Base' LIMIT 1;
        
        INSERT INTO public.leads (workspace_id, stage_id, name, email, company, role, source)
        VALUES 
        (p_workspace_id, v_base_id, 'Andrey Bertoletti', 'andrey@exemplo.com', 'Vibe Coding', 'CEO', 'Inbound'),
        (p_workspace_id, v_base_id, 'DeepMind Bot', 'bot@google.com', 'Google', 'AI Researcher', 'Direct');
    END IF;
END;
$$;

-- APLICAR PATCH EM TODOS OS WORKSPACES EXISTENTES
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.workspaces LOOP
        PERFORM public.seed_workspace_pipeline(r.id, FALSE);
    END LOOP;
END;
$$;
