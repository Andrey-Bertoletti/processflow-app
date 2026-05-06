create or replace function public.is_valid_lead_assignee(p_workspace_id uuid, p_assigned_to uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_assigned_to is null
    or exists (
      select 1
      from public.workspace_users wu
      where wu.workspace_id = p_workspace_id
        and wu.user_id = p_assigned_to
    );
$$;

create or replace function public.get_workspace_members(p_workspace_id uuid)
returns table (
  id uuid,
  user_id uuid,
  role text,
  email text,
  display_name text
)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    wu.id,
    wu.user_id,
    wu.role,
    u.email,
    coalesce(nullif(trim(u.email), ''), wu.user_id::text) as display_name
  from public.workspace_users wu
  left join auth.users u on u.id = wu.user_id
  where wu.workspace_id = p_workspace_id
  order by wu.created_at asc;
$$;

revoke execute on function public.is_valid_lead_assignee(uuid, uuid) from public;
revoke execute on function public.is_valid_lead_assignee(uuid, uuid) from anon;
grant execute on function public.is_valid_lead_assignee(uuid, uuid) to authenticated;
grant execute on function public.is_valid_lead_assignee(uuid, uuid) to service_role;

revoke execute on function public.get_workspace_members(uuid) from public;
revoke execute on function public.get_workspace_members(uuid) from anon;
grant execute on function public.get_workspace_members(uuid) to authenticated;
grant execute on function public.get_workspace_members(uuid) to service_role;

drop policy if exists "leads_insert" on public.leads;
drop policy if exists "leads_update" on public.leads;

create policy "leads_insert"
on public.leads
for insert
with check (
  public.is_user_in_workspace(workspace_id)
  and public.is_valid_lead_assignee(workspace_id, assigned_to)
);

create policy "leads_update"
on public.leads
for update
using (public.is_user_in_workspace(workspace_id))
with check (
  public.is_user_in_workspace(workspace_id)
  and public.is_valid_lead_assignee(workspace_id, assigned_to)
);
