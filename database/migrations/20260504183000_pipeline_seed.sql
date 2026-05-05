create or replace function public.seed_workspace_pipeline(
  p_workspace_id uuid,
  p_with_demo_leads boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
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
$$;

grant execute on function public.seed_workspace_pipeline(uuid, boolean) to authenticated;
grant execute on function public.seed_workspace_pipeline(uuid, boolean) to service_role;
