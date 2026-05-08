-- Performance: composite indexes for frequent query shapes
-- (Kanban by workspace+stage, messages by workspace+status, timeline by lead)

CREATE INDEX IF NOT EXISTS idx_leads_workspace_stage_created_at
  ON public.leads (workspace_id, stage_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_workspace_status_created_at
  ON public.messages (workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activities_lead_created_at
  ON public.activities (lead_id, created_at DESC);
