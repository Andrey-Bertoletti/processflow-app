-- Migration: RPC to add member by email
-- Timestamp: 20260507180000

CREATE OR REPLACE FUNCTION public.add_workspace_member_by_email(p_workspace_id uuid, p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_caller_id uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  -- 1. Validar se o chamador é admin do workspace
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_users 
    WHERE workspace_id = p_workspace_id AND user_id = v_caller_id AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RETURN jsonb_build_object('success', false, 'message', 'Apenas administradores podem adicionar membros.');
  END IF;

  -- 2. Localizar o usuário pelo email
  SELECT id INTO v_user_id FROM auth.users WHERE email = trim(lower(p_email));

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado. Peça para ele se cadastrar na plataforma primeiro.');
  END IF;

  -- 3. Tentar adicionar ao workspace
  BEGIN
    INSERT INTO public.workspace_users (workspace_id, user_id, role)
    VALUES (p_workspace_id, v_user_id, 'member');
    
    RETURN jsonb_build_object('success', true, 'message', 'Membro adicionado com sucesso.');
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este usuário já é membro deste workspace.');
  END;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_workspace_member_by_email(uuid, text) FROM public;
REVOKE EXECUTE ON FUNCTION public.add_workspace_member_by_email(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_workspace_member_by_email(uuid, text) TO service_role;
