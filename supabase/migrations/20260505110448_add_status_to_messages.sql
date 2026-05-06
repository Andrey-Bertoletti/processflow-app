-- Correção emergencial para garantir a existência da coluna status antes dos triggers da timeline
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='status') THEN
    ALTER TABLE public.messages ADD COLUMN status TEXT DEFAULT 'success';
  END IF;
END $$;
