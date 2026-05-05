create table public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  response text not null,
  created_at timestamp with time zone default now()
);

alter table public.ai_generations enable row level security;

create policy "Users can insert ai_generations to their workspace"
  on public.ai_generations
  for insert
  with check (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

create policy "Users can view ai_generations from their workspace"
  on public.ai_generations
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

create index idx_ai_generations_lead_campaign on public.ai_generations(lead_id, campaign_id);
create index idx_ai_generations_user_created on public.ai_generations(user_id, created_at);
