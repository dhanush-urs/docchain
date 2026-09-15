import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function main() {
  const email = 'bharathp4002@gmail.com'

  // Get user ID
  const { data: { users } } = await supabase.auth.admin.listUsers()
  const user = users.find(u => u.email === email)
  if (!user) {
    console.error('User not found')
    return
  }

  console.log(`User ID: ${user.id}`)

  console.log('Inserting into public.profiles...')
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: user.id,
    email: user.email,
    full_name: 'Bharath Admin',
    role: 'admin'
  })

  if (profileError) console.error('Error with profile:', profileError)
  else console.log('Profile created/updated successfully!')

  // Get the default workspace
  const { data: workspaces } = await supabase.from('workspaces').select('*').limit(1)
  if (workspaces && workspaces.length > 0) {
    const workspaceId = workspaces[0].id
    console.log(`Found workspace: ${workspaceId}. Adding as admin...`)
    const { error: memberError } = await supabase.from('workspace_members').upsert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: 'admin'
    }, { onConflict: 'workspace_id,user_id' })
    
    if (memberError) console.error('Error with workspace member:', memberError)
    else console.log('Added to workspace successfully!')
  }

  console.log('Done!')
}

main()
