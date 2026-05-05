drop table if exists public.campaigns cascade;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  context text not null,
  base_prompt text not null,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- RLS
alter table public.campaigns enable row level security;

create policy "Users can view campaigns from their workspace"
  on public.campaigns
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

create policy "Users can insert campaigns to their workspace"
  on public.campaigns
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

create policy "Users can update campaigns in their workspace"
  on public.campaigns
  for update
  using (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

create policy "Users can delete campaigns from their workspace"
  on public.campaigns
  for delete
  using (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );
