-- Adiciona a coluna se ela não existir antes de tentar aplicar restrições
ALTER TABLE public.stages 
ADD COLUMN IF NOT EXISTS required_fields jsonb DEFAULT '[]'::jsonb;

-- Garante as restrições
ALTER TABLE public.stages 
ALTER COLUMN required_fields SET DEFAULT '[]'::jsonb,
ALTER COLUMN required_fields SET NOT NULL;
-- Refinamento da estrutura de estágios e validação
ALTER TABLE public.stages 
ALTER COLUMN required_fields SET DEFAULT '[]'::jsonb,
ALTER COLUMN required_fields SET NOT NULL;

-- Garante o índice de performance por workspace
CREATE INDEX IF NOT EXISTS idx_stages_workspace ON public.stages(workspace_id);

-- Função de validação no banco de dados (Versão de Produção)
CREATE OR REPLACE FUNCTION public.validate_stage_requirements()
RETURNS trigger AS $$
DECLARE
  v_required JSONB;
  v_field_rule JSONB;
  v_field_name TEXT;
  v_field_value TEXT;
  v_new_json JSONB;
  v_old_json JSONB;
  v_stage_name TEXT;
BEGIN
  -- Pega as regras da etapa de destino (com proteção contra NULL)
  SELECT coalesce(required_fields, '[]'::jsonb), name
  INTO v_required, v_stage_name
  FROM public.stages
  WHERE id = NEW.stage_id;

  -- Se não houver regras, permite a movimentação
  IF v_required IS NULL OR jsonb_array_length(v_required) = 0 THEN
    RETURN NEW;
  END IF;

  -- Converte os records em JSONB para acesso dinâmico (necessário para COALESCE em updates parciais)
  v_new_json := to_jsonb(NEW);
  v_old_json := to_jsonb(OLD);

  -- Percorre as regras obrigatórias
  FOR v_field_rule IN SELECT jsonb_array_elements(v_required) LOOP
    v_field_name := v_field_rule->>'field';
    
    -- Pega o valor do campo (novo ou atual, para suportar updates parciais)
    v_field_value := coalesce(v_new_json->>v_field_name, v_old_json->>v_field_name);

    -- Validação de presença e conteúdo
    IF v_field_value IS NULL OR trim(v_field_value) = '' THEN
      RAISE EXCEPTION USING
        MESSAGE = 'VALIDATION_ERROR',
        DETAIL = v_field_name,
        HINT = 'Required field missing: ' || (v_field_rule->>'label');
    END IF;

  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reaplica o trigger
DROP TRIGGER IF EXISTS trg_validate_stage ON public.leads;

CREATE TRIGGER trg_validate_stage
BEFORE UPDATE ON public.leads
FOR EACH ROW
WHEN (OLD.stage_id IS DISTINCT FROM NEW.stage_id)
EXECUTE FUNCTION public.validate_stage_requirements();
