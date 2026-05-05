create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null, -- 'STAGE_CHANGE', 'CREATED', etc.
  old_stage_id uuid references public.stages(id) on delete set null,
  new_stage_id uuid references public.stages(id) on delete set null,
  created_at timestamp with time zone default now()
);

alter table public.lead_events enable row level security;

create policy "Users can view lead_events from their workspace"
  on public.lead_events
  for select
  using (
    workspace_id in (
      select workspace_id from public.workspace_users where user_id = auth.uid()
    )
  );

-- Trigger to auto-log stage changes
create or replace function log_lead_stage_change()
returns trigger as $$
begin
  if (TG_OP = 'UPDATE' and old.stage_id is distinct from new.stage_id) then
    insert into public.lead_events (
      workspace_id,
      lead_id,
      user_id,
      event_type,
      old_stage_id,
      new_stage_id
    ) values (
      new.workspace_id,
      new.id,
      auth.uid(),
      'STAGE_CHANGE',
      old.stage_id,
      new.stage_id
    );
  elsif (TG_OP = 'INSERT') then
    insert into public.lead_events (
      workspace_id,
      lead_id,
      user_id,
      event_type,
      new_stage_id
    ) values (
      new.workspace_id,
      new.id,
      auth.uid(),
      'CREATED',
      new.stage_id
    );
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_log_lead_stage_change
after insert or update of stage_id on public.leads
for each row
execute function log_lead_stage_change();
