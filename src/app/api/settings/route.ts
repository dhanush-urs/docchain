import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const { data: workspaces } = await adminSupabase
      .from('workspace_members')
      .select(`
        *,
        workspace:workspaces(name),
        user:profiles(email, full_name)
      `)
      .eq('user_id', user.id)

    return NextResponse.json({ profile, workspaces: workspaces || [] })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { fullName, avatarUrl } = await request.json()
    const adminSupabase = createAdminClient()

    const updates: any = {}
    if (fullName !== undefined) updates.full_name = fullName
    if (avatarUrl !== undefined) updates.avatar_url = avatarUrl

    const { error } = await adminSupabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
