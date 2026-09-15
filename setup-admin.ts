import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const email = 'dhanushurs667@gmail.com'
  const password = 'dhanush@143'

  console.log(`Attempting to sign up ${email}...`)
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })

  if (error) {
    console.error('Signup error:', error.message)
    return
  }

  console.log('Signup successful! User ID:', data.user?.id)
  console.log('\nRun the following SQL in Supabase Editor to complete setup:\n')
  console.log(`
DO $$
DECLARE
  v_new_user_id UUID := '${data.user?.id}';
  v_workspace_id UUID;
BEGIN
  -- 1. Create Profile
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (v_new_user_id, '${email}', 'Admin User', 'admin')
  ON CONFLICT (id) DO UPDATE SET role = 'admin';

  -- 2. Create Workspace
  INSERT INTO public.workspaces (name, slug, description, visibility, owner_id)
  VALUES ('Global Docs', 'global-docs', 'Main workspace for public documents', 'public', v_new_user_id)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO v_workspace_id;

  -- 3. Add Admin to Workspace
  IF v_workspace_id IS NOT NULL THEN
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (v_workspace_id, v_new_user_id, 'admin')
    ON CONFLICT DO NOTHING;
    
    PERFORM create_genesis_block(v_workspace_id);
  END IF;
END $$;
  `)
}

main()
