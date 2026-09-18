import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.email !== 'dhanushurs667@gmail.com') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { workspaceId } = await request.json()

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Delete related records manually to ensure no FK constraint failures if cascade isn't perfect
    await adminSupabase.from('timeline_events').delete().eq('workspace_id', workspaceId)
    await adminSupabase.from('blockchain_blocks').delete().eq('workspace_id', workspaceId)
    
    const { data: docs } = await adminSupabase.from('documents').select('id').eq('workspace_id', workspaceId)
    if (docs && docs.length > 0) {
      await adminSupabase.from('document_versions').delete().in('document_id', docs.map(d => d.id))
      await adminSupabase.from('documents').delete().eq('workspace_id', workspaceId)
    }
    
    await adminSupabase.from('workspace_members').delete().eq('workspace_id', workspaceId)
    
    // Finally delete the workspace
    const { error } = await adminSupabase.from('workspaces').delete().eq('id', workspaceId)
    
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Delete workspace error:', error)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}
