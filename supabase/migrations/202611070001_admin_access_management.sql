-- Owner-controlled administrator access management.
-- The earliest admin_members row is the protected owner account.

CREATE OR REPLACE FUNCTION public.admin_manage_access(
  p_action text,
  p_email text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  role text,
  created_at timestamptz,
  is_owner boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_owner_id uuid;
  v_target_id uuid;
BEGIN
  SELECT am.user_id
    INTO v_owner_id
  FROM public.admin_members AS am
  ORDER BY am.created_at ASC NULLS LAST, am.user_id ASC
  LIMIT 1;

  IF v_owner_id IS NULL OR auth.uid() IS DISTINCT FROM v_owner_id THEN
    RAISE EXCEPTION 'Only the owner account can manage administrator access';
  END IF;

  IF p_action = 'add' THEN
    IF p_email IS NULL OR btrim(p_email) = '' THEN
      RAISE EXCEPTION 'Enter the registered email address';
    END IF;

    SELECT u.id
      INTO v_target_id
    FROM auth.users AS u
    WHERE lower(u.email) = lower(btrim(p_email))
    LIMIT 1;

    IF v_target_id IS NULL THEN
      RAISE EXCEPTION 'No registered account was found for that email';
    END IF;

    INSERT INTO public.admin_members (user_id, role)
    VALUES (v_target_id, 'admin')
    ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

  ELSIF p_action = 'remove' THEN
    IF p_user_id IS NULL THEN
      RAISE EXCEPTION 'Select an administrator to remove';
    END IF;
    IF p_user_id = v_owner_id THEN
      RAISE EXCEPTION 'The owner account cannot be removed';
    END IF;

    DELETE FROM public.admin_members AS am
    WHERE am.user_id = p_user_id;

  ELSIF p_action <> 'list' THEN
    RAISE EXCEPTION 'Unsupported administrator action';
  END IF;

  RETURN QUERY
  SELECT
    am.user_id,
    u.email::text,
    am.role::text,
    am.created_at,
    (am.user_id = v_owner_id) AS is_owner
  FROM public.admin_members AS am
  LEFT JOIN auth.users AS u ON u.id = am.user_id
  ORDER BY am.created_at ASC NULLS LAST, am.user_id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_access(text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_access(text, text, uuid) TO authenticated;
