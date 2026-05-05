create type "public"."campaign_status" as enum ('draft', 'active', 'finished');

CREATE INDEX idx_workspace_users_user ON public.workspace_users USING btree (user_id);

CREATE INDEX idx_workspace_users_workspace ON public.workspace_users USING btree (workspace_id);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_default_stages()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  insert into stages (name, "order", workspace_id)
  values
    ('Base', 1, new.id),
    ('Lead Mapeado', 2, new.id),
    ('Tentando Contato', 3, new.id),
    ('Em Negociação', 4, new.id);

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.seed_workspace_pipeline(p_workspace_id uuid, p_with_demo_leads boolean DEFAULT true)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  v_base_stage_id uuid;
  v_mapped_stage_id uuid;
  v_contact_stage_id uuid;
  v_negotiation_stage_id uuid;
begin
  if p_workspace_id is null then
    raise exception 'workspace_id is required';
  end if;

  if not public.is_user_in_workspace(p_workspace_id) then
    raise exception 'user is not in workspace %', p_workspace_id;
  end if;

  insert into public.stages (workspace_id, name, "order")
  values
    (p_workspace_id, 'Base', 1),
    (p_workspace_id, 'Lead Mapeado', 2),
    (p_workspace_id, 'Tentando Contato', 3),
    (p_workspace_id, 'Em Negociação', 4)
  on conflict (workspace_id, "order") do update
    set name = excluded.name;

  if p_with_demo_leads then
    select id into v_base_stage_id
    from public.stages
    where workspace_id = p_workspace_id and "order" = 1
    limit 1;

    select id into v_mapped_stage_id
    from public.stages
    where workspace_id = p_workspace_id and "order" = 2
    limit 1;

    select id into v_contact_stage_id
    from public.stages
    where workspace_id = p_workspace_id and "order" = 3
    limit 1;

    select id into v_negotiation_stage_id
    from public.stages
    where workspace_id = p_workspace_id and "order" = 4
    limit 1;

    if not exists (
      select 1
      from public.leads
      where workspace_id = p_workspace_id
    ) then
      insert into public.leads (workspace_id, stage_id, name, email, phone)
      values
        (p_workspace_id, v_base_stage_id, 'Apex Consultoria', 'contato@apex-consultoria.com', '(11) 99999-1001'),
        (p_workspace_id, v_mapped_stage_id, 'Norte Logistica', 'diretoria@nortelog.com', '(11) 99999-1002'),
        (p_workspace_id, v_contact_stage_id, 'Clinica Vida Integral', 'comercial@vidaintegral.com', '(11) 99999-1003'),
        (p_workspace_id, v_negotiation_stage_id, 'Grupo Orion Educacional', 'compras@orionedu.com', '(11) 99999-1004');
    end if;
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_stage_requirements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_required JSONB;
  v_field_rule JSONB;
  v_field_name TEXT;
  v_field_value TEXT;
  v_new_json JSONB;
  v_old_json JSONB;
  v_stage_name TEXT;
BEGIN
  -- Pega as regras da etapa de destino (com proteção contra NULL)
  SELECT coalesce(required_fields, '[]'::jsonb), name
  INTO v_required, v_stage_name
  FROM public.stages
  WHERE id = NEW.stage_id;

  -- Se não houver regras, permite a movimentação
  IF v_required IS NULL OR jsonb_array_length(v_required) = 0 THEN
    RETURN NEW;
  END IF;

  -- Converte os records em JSONB para acesso dinâmico (necessário para COALESCE em updates parciais)
  v_new_json := to_jsonb(NEW);
  v_old_json := to_jsonb(OLD);

  -- Percorre as regras obrigatórias
  FOR v_field_rule IN SELECT jsonb_array_elements(v_required) LOOP
    v_field_name := v_field_rule->>'field';
    
    -- Pega o valor do campo (novo ou atual, para suportar updates parciais)
    v_field_value := coalesce(v_new_json->>v_field_name, v_old_json->>v_field_name);

    -- Validação de presença e conteúdo
    IF v_field_value IS NULL OR trim(v_field_value) = '' THEN
      RAISE EXCEPTION 'Campo obrigatório faltando: % para a etapa %', 
        (v_field_rule->>'label'), 
        v_stage_name;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;

CREATE TRIGGER after_workspace_insert AFTER INSERT ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.create_default_stages();


