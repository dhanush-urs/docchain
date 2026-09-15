import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const limit = parseInt(searchParams.get('limit') || '50')

    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspaceId' }, { status: 400 })
    }

    // Check membership using admin client to bypass RLS recursion
    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }

    const { data: blocks, error } = await supabase
      .from('blockchain_blocks')
      .select(`
        *,
        transaction:blockchain_transactions(
          *,
          actor:profiles(full_name, email)
        )
      `)
      .eq('workspace_id', workspaceId)
      .order('block_index', { ascending: false })
      .limit(limit)

    if (error) throw error

    return NextResponse.json({ blocks })
  } catch (error) {
    console.error('Blockchain GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const adminSupabase = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { workspaceId, eventType, documentId, documentVersionId, payload } = body

    if (!workspaceId || !eventType) {
      return NextResponse.json({ error: 'Missing workspaceId or eventType' }, { status: 400 })
    }

    // Check membership using admin client
    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }

    const { data: blockId, error } = await supabase.rpc('append_blockchain_event', {
      p_workspace_id: workspaceId,
      p_event_type: eventType,
      p_actor_id: user.id,
      p_document_id: documentId,
      p_document_version_id: documentVersionId,
      p_payload: payload || {}
    })

    if (error) throw error

    return NextResponse.json({ blockId, message: 'Blockchain event recorded' }, { status: 201 })
  } catch (error) {
    console.error('Blockchain POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}