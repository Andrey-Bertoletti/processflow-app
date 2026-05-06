set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.validate_stage_requirements()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
      RAISE EXCEPTION 'Campo obrigatório faltando: % para a etapa %', 
        (v_field_rule->>'label'), 
        v_stage_name;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$
;


