-- 1. Create a function to create a new Event Branch (Workspace)
CREATE OR REPLACE FUNCTION public.create_new_event(
  event_name text,
  creator_id uuid
)
RETURNS uuid AS $$
DECLARE
  v_workspace_id uuid;
  v_slug text;
BEGIN
  -- Generate a URL-friendly slug
  v_slug := lower(regexp_replace(event_name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || floor(random() * 1000)::text;

  -- Insert the new branch (workspace)
  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (event_name, v_slug, creator_id)
  RETURNING id INTO v_workspace_id;

  -- The creator is automatically added as admin
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_workspace_id, creator_id, 'admin', now());

  -- Generate the Genesis Block for the new branch
  INSERT INTO public.blockchain_blocks (
    workspace_id, 
    block_index, 
    previous_hash, 
    hash, 
    merkle_root, 
    nonce, 
    difficulty, 
    created_at,
    block_hash,
    transaction_hash,
    payload_hash
  )
  VALUES (
    v_workspace_id,
    0,
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    '0000000000000000000000000000000000000000000000000000000000000000',
    0,
    4,
    now(),
    '0000000000000000000000000000000000000000000000000000000000000000',
    'genesis',
    'genesis'
  );

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
