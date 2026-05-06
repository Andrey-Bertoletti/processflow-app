create or replace function public.can_access_workspace(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspaces w
    where w.id = p_workspace_id
      and w.owner_id = auth.uid()
  )
  or exists (
    select 1
    from public.workspace_users wu
    where wu.workspace_id = p_workspace_id
      and wu.user_id = auth.uid()
  );
$$;

create or replace function public.is_user_in_workspace(ws_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_access_workspace(ws_id);
$$;

grant execute on function public.can_access_workspace(uuid) to authenticated;
grant execute on function public.can_access_workspace(uuid) to service_role;

grant execute on function public.is_user_in_workspace(uuid) to anon;
grant execute on function public.is_user_in_workspace(uuid) to authenticated;
grant execute on function public.is_user_in_workspace(uuid) to service_role;

drop policy if exists "User can insert own membership" on public.workspace_users;
drop policy if exists "User can view own memberships" on public.workspace_users;
drop policy if exists "users_can_add_workspace_members" on public.workspace_users;
drop policy if exists "users_can_view_workspace_members" on public.workspace_users;

drop policy if exists "User can create workspace" on public.workspaces;
drop policy if exists "User can view own workspaces" on public.workspaces;
drop policy if exists "users_can_create_workspaces" on public.workspaces;
drop policy if exists "users_can_update_own_workspaces" on public.workspaces;
drop policy if exists "users_can_view_own_workspaces" on public.workspaces;

create policy "workspace_users_select"
on public.workspace_users
for select
using (public.can_access_workspace(workspace_id));

create policy "workspace_users_insert_owner"
on public.workspace_users
for insert
with check (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_users.workspace_id
      and w.owner_id = auth.uid()
  )
);

create policy "workspace_users_update_owner"
on public.workspace_users
for update
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_users.workspace_id
      and w.owner_id = auth.uid()
  )
);

create policy "workspace_users_delete_owner"
on public.workspace_users
for delete
using (
  exists (
    select 1
    from public.workspaces w
    where w.id = workspace_users.workspace_id
      and w.owner_id = auth.uid()
  )
);

create policy "workspaces_select"
on public.workspaces
for select
using (public.can_access_workspace(id));

create policy "workspaces_insert_owner"
on public.workspaces
for insert
with check (auth.uid() = owner_id);

create policy "workspaces_update_owner"
on public.workspaces
for update
using (auth.uid() = owner_id);

create policy "workspaces_delete_owner"
on public.workspaces
for delete
using (auth.uid() = owner_id);
