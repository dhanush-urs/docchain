-- ==============================================================================
-- DOCCHAIN BRANCHING (MULTI-EVENT) SYSTEM
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor to enable creating new branches.
-- This creates a Postgres function that safely provisions a new Event/Workspace,
-- grants the creator admin rights, and generates the vital Genesis Block.

CREATE OR REPLACE FUNCTION public.create_new_event(event_name text, creator_id uuid)
RETURNS uuid AS $$
DECLARE
  new_ws_id uuid;
BEGIN
  -- 1. Create the new workspace (event branch)
  INSERT INTO public.workspaces (name, created_by)
  VALUES (event_name, creator_id)
  RETURNING id INTO new_ws_id;

  -- 2. Add the creator as the admin of the new event
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (new_ws_id, creator_id, 'admin', now());

  -- 3. Generate the isolated Genesis Block for this new event's blockchain
  INSERT INTO public.blockchain_blocks (
    workspace_id, 
    block_index, 
    previous_hash, 
    hash, 
    merkle_root, 
    nonce, 
    difficulty, 
    created_at
  ) VALUES (
    new_ws_id, 
    0, 
    '0000000000000000000000000000000000000000000000000000000000000000', 
    '0000000000000000000000000000000000000000000000000000000000000000', 
    '0000000000000000000000000000000000000000000000000000000000000000', 
    0, 
    4, 
    now()
  );

  RETURN new_ws_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
