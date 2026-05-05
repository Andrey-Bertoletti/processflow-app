-- Migration: Add missing mandatory lead fields
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS company TEXT,
ADD COLUMN IF NOT EXISTS role TEXT,
ADD COLUMN IF NOT EXISTS source TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Update RLS policies to ensure visibility
-- (Policies usually cover all columns, but good to keep track)

-- Adding indexes for search performance on these fields
CREATE INDEX IF NOT EXISTS idx_leads_company ON public.leads(company);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);

-- Update the audit event sourcing to capture these new fields if needed
-- (The existing trigger handles the whole ROW, so it's automatic)
