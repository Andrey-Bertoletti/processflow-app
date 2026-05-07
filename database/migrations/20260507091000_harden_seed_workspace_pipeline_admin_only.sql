-- Migration: Harden seed_workspace_pipeline (admin-only)
-- Timestamp: 2026-05-07091000
--
-- Why:
-- `seed_workspace_pipeline` is SECURITY DEFINER (bypasses RLS) and configures stages.
-- This must be restricted to workspace admins only.

CREATE OR REPLACE FUNCTION public.seed_workspace_pipeline(
    p_workspace_id UUID,
    p_with_demo_leads BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_base_id UUID;
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
    IF NOT public.is_workspace_admin(p_workspace_id) THEN
        RAISE EXCEPTION USING
          MESSAGE = 'FORBIDDEN',
          ERRCODE = '42501',
          DETAIL = 'seed_workspace_pipeline requires admin role for the workspace';
    END IF;

    -- Criar/normalizar etapas (idempotente)
    FOREACH v_name IN ARRAY v_stage_names LOOP
        INSERT INTO public.stages (workspace_id, name, "order")
        VALUES (p_workspace_id, v_name, v_order)
        ON CONFLICT (workspace_id, name) DO UPDATE
        SET "order" = v_order;

        v_order := v_order + 10;
    END LOOP;

    -- Leads demo (opcional)
    IF p_with_demo_leads THEN
        SELECT id INTO v_base_id
        FROM public.stages
        WHERE workspace_id = p_workspace_id AND name = 'Base'
        LIMIT 1;

        INSERT INTO public.leads (workspace_id, stage_id, name, email, company, role, source)
        VALUES
          (p_workspace_id, v_base_id, 'Andrey Bertoletti', 'andrey@exemplo.com', 'Vibe Coding', 'CEO', 'Inbound'),
          (p_workspace_id, v_base_id, 'DeepMind Bot', 'bot@google.com', 'Google', 'AI Researcher', 'Direct');
    END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_workspace_pipeline(uuid, boolean) FROM public;
REVOKE EXECUTE ON FUNCTION public.seed_workspace_pipeline(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.seed_workspace_pipeline(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_workspace_pipeline(uuid, boolean) TO service_role;

