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
    
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    const isGlobalAdmin = profile?.role === 'admin'

    let workspaces = []

    if (isGlobalAdmin) {
      // Global admins see all workspaces
      const { data } = await adminSupabase.from('workspaces').select('*').order('created_at', { ascending: true })
      workspaces = data || []
    } else {
      // Regular users see only workspaces they belong to
      const { data } = await adminSupabase
        .from('workspace_members')
        .select('workspace:workspaces(*)')
        .eq('user_id', user.id)
      
      workspaces = (data || []).map(m => m.workspace).filter(Boolean)
      // sort by created_at
      workspaces.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    }

    return NextResponse.json({ workspaces })
  } catch (error: any) {
    console.error('Workspaces GET error:', error)
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
