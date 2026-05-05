create or replace function public.create_workspace_with_owner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace_id uuid;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'workspace name is required';
  end if;

  insert into public.workspaces (name, owner_id)
  values (trim(p_name), v_user_id)
  returning id into v_workspace_id;

  insert into public.workspace_users (workspace_id, user_id, role)
  values (v_workspace_id, v_user_id, 'owner')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role;

  return v_workspace_id;
end;
$$;

revoke execute on function public.create_workspace_with_owner(text) from public;
revoke execute on function public.create_workspace_with_owner(text) from anon;
grant execute on function public.create_workspace_with_owner(text) to authenticated;
grant execute on function public.create_workspace_with_owner(text) to service_role;
