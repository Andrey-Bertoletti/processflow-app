-- 1. Adicionando coluna 'auto_campaign_id' na tabela 'stages'
ALTER TABLE public.stages
ADD COLUMN IF NOT EXISTS auto_campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL;

-- 2. Adicionando coluna 'is_automated' na tabela 'messages'
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS is_automated BOOLEAN DEFAULT false;

-- (Opcional, caso não exista a tabela messages)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_automated BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ativando RLS na messages (caso tenha acabado de criar ou não esteja ativa)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages from their workspace"
  ON public.messages
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their workspace"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM public.workspace_users WHERE user_id = auth.uid()
    )
  );

-- Habilitar replicação em tempo real para a tabela messages
-- IMPORTANTE para a UI atualizar automaticamente!
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
