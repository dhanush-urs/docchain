import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import fs from 'fs'
dotenv.config()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'bharathp4002@gmail.com',
    password: 'bharath@123'
  })
  
  if (error) {
    console.error('Login error:', error)
    return
  }
  
  const token = data.session.access_token
  
  // Need to use fetch with cookie for Next.js App Router API
  const res = await fetch('http://127.0.0.1:3000/api/dashboard', {
    headers: {
      cookie: `sb-${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0]}-auth-token=${JSON.stringify(data.session)}`
    }
  })
  
  console.log('Status:', res.status)
  const json = await res.json()
  console.log('Response:', json)
}
main()
