do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'unique_stage_order'
      and conrelid = 'public.stages'::regclass
  ) then
    alter table public.stages
      add constraint unique_stage_order unique (workspace_id, "order");
  end if;
end;
$$;

revoke execute on function public.seed_workspace_pipeline(uuid, boolean) from anon;
grant execute on function public.seed_workspace_pipeline(uuid, boolean) to authenticated;
grant execute on function public.seed_workspace_pipeline(uuid, boolean) to service_role;
