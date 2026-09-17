import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()


    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    const activeWorkspaceIdCookie = request.cookies.get('active_workspace_id')?.value
    const isGlobalAdmin = profile?.role === 'admin'


    const cookieStore = await cookies()
    const activeWsId = cookieStore.get('active_workspace_id')?.value

    let workspaceId: string

    if (isGlobalAdmin) {
       let ws = null;
       if (activeWsId) {
         const { data } = await adminSupabase.from('workspaces').select('id').eq('id', activeWsId).single()
         ws = data
       }
       if (!ws) {
         const { data } = await adminSupabase.from('workspaces').select('id').limit(1).single()
         ws = data
       }
       if (!ws) {
         return NextResponse.json({ error: 'No workspace found' }, { status: 404 })
       }
       workspaceId = ws.id

    } else {
      // 1. Get workspace safely
      const { data: member } = await adminSupabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'Not a member of any workspace' }, { status: 403 })
      }
      workspaceId = member.workspace_id
    }


    // 2. Fetch stats
    const [docsRes, blocksRes, verifiedRes, docsWithVersions, eventsRes] = await Promise.all([
      adminSupabase.from('documents').select('id', { count: 'exact' }).eq('workspace_id', workspaceId).eq('status', 'active'),
      adminSupabase.from('blockchain_blocks').select('id', { count: 'exact' }).eq('workspace_id', workspaceId),
      Promise.resolve({ count: 0, data: null, error: null }), // verified column does not exist in schema
      adminSupabase.from('documents').select('current_version').eq('workspace_id', workspaceId).eq('status', 'active'),
      adminSupabase
        .from('timeline_events')
        .select(`
          *,
          actor:profiles(full_name, email),
          document:documents(original_filename),
          document_version:document_versions(version_number),
          block:blockchain_blocks(block_index)
        `)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    const totalVersions = (docsWithVersions.data || []).reduce((sum, d) => sum + (d.current_version || 0), 0)

    const stats = {
      docCount: docsRes.count || 0,
      blockCount: blocksRes.count || 0,
      verifiedCount: verifiedRes.count || 0,
      totalVersions
    }

    return NextResponse.json({ stats, recentActivity: eventsRes.data || [] })
  } catch (error: any) {
    console.error('Dashboard GET error:', error)
    try {
      require('fs').appendFileSync('/tmp/dashboard_error.txt', new Date().toISOString() + ': ' + (error.stack || error.toString() || JSON.stringify(error)) + '\n')
    } catch (e) {}
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 })
  }
}
