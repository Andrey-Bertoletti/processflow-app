alter table public.leads
  add column if not exists assigned_to uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'leads_assigned_to_fkey'
      and conrelid = 'public.leads'::regclass
  ) then
    alter table public.leads
      add constraint leads_assigned_to_fkey
      foreign key (assigned_to)
      references auth.users (id)
      on delete set null;
  end if;
end;
$$;

create index if not exists idx_leads_assigned_to
  on public.leads (assigned_to);
