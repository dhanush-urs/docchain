import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config()

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials in .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createAdmin() {
  console.log('Signing up user codeis@gmail.com...')
  
  const { data, error } = await supabase.auth.signUp({
    email: 'codeis@gmail.com',
    password: 'CodeIsOG'
  })

  if (error) {
    console.error('Signup error:', error.message)
    return
  }

  console.log('Signup data:', data)
  console.log('User created/signed up successfully.')
  console.log('Note: To make them an admin, the profile must be updated manually in the Supabase Dashboard since we do not have the service_role key.')
}

createAdmin()
