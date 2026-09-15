-- Create trigger to automatically handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_workspace_id UUID;
  v_is_first_user BOOLEAN;
BEGIN
  -- Create profile (first user gets admin)
  SELECT NOT EXISTS(SELECT 1 FROM public.profiles) INTO v_is_first_user;
  
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (new.id, new.email, '', CASE WHEN v_is_first_user THEN 'admin' ELSE 'viewer' END)
  ON CONFLICT (id) DO NOTHING;

  -- Get the main workspace
  SELECT id INTO v_workspace_id FROM public.workspaces ORDER BY created_at ASC LIMIT 1;
  
  IF v_workspace_id IS NOT NULL THEN
    -- Add to workspace
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, new.id, CASE WHEN v_is_first_user THEN 'admin' ELSE 'viewer' END)
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Add RLS policy so global admins can see all documents regardless of workspace
DROP POLICY IF EXISTS "Global admins can view all documents" ON documents;
CREATE POLICY "Global admins can view all documents" ON documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
