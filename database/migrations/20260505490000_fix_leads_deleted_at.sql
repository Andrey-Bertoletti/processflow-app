-- Migration: Fix leads table with deleted_at for soft delete support
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for soft delete performance
CREATE INDEX IF NOT EXISTS idx_leads_deleted_at ON public.leads(deleted_at) WHERE deleted_at IS NULL;
