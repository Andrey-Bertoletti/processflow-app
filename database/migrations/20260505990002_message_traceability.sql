-- Migration: AI Message Traceability
-- Adds tracking fields to messages table

ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS variation_index INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS prompt_hash TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Index for cache lookup performance
CREATE INDEX IF NOT EXISTS idx_messages_prompt_hash ON public.messages(prompt_hash);
