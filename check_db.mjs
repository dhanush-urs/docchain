import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function main() {
  const { data: users } = await supabase.auth.admin.listUsers()
  const bharath = users.users.find(u => u.email === 'bharathp4002@gmail.com')
  if (bharath) {
    console.log('Bharath ID:', bharath.id)
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', bharath.id)
    console.log('Profile:', profile)
    const { data: member } = await supabase.from('workspace_members').select('*').eq('user_id', bharath.id)
    console.log('Workspace Member:', member)
  }
}
main()
