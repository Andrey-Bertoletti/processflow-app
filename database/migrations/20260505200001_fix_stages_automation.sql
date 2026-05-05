-- Migration: Fix stages table with auto_campaign_id for AI triggers
ALTER TABLE public.stages 
ADD COLUMN IF NOT EXISTS auto_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_stages_auto_campaign ON public.stages(auto_campaign_id);
