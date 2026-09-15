import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const documentId = searchParams.get('documentId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'active'

    // Get membership automatically using admin client to bypass RLS recursion bug
    const adminSupabase = createAdminClient()
    let targetWorkspaceId = workspaceId;

    if (documentId && !targetWorkspaceId) {
      // Find the workspace id for the document
      const { data: docInfo } = await adminSupabase
        .from('documents')
        .select('workspace_id')
        .eq('id', documentId)
        .single()
      if (docInfo) targetWorkspaceId = docInfo.workspace_id
    }

    if (!targetWorkspaceId) {
      const { data: member } = await adminSupabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .in('role', ['admin', 'editor', 'viewer'])
        .limit(1)
        .single()
      
      if (!member) {
        return NextResponse.json({ error: 'Not a member of any workspace' }, { status: 403 })
      }
      targetWorkspaceId = member.workspace_id
    }

    // Verify membership for the target workspace
    const { data: membership } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', targetWorkspaceId)
      .single()

    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }

    if (documentId) {
      const { data, error } = await adminSupabase
        .from('documents')
        .select('*, workspace:workspaces(name)')
        .eq('id', documentId)
        .eq('workspace_id', targetWorkspaceId)
        .single()

      if (error || !data) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

      // Fetch versions
      const { data: versionsData } = await adminSupabase
        .from('document_versions')
        .select('*')
        .eq('document_id', documentId)
        .order('version_number', { ascending: false })

      const versionsWithUrls = await Promise.all((versionsData || []).map(async (v) => {
        const { data: preview } = await adminSupabase.storage
          .from('documents')
          .createSignedUrl(v.storage_path, 3600)
          
        const { data: download } = await adminSupabase.storage
          .from('documents')
          .createSignedUrl(v.storage_path, 3600, { download: true })
          
        return {
          ...v,
          preview_url: preview?.signedUrl || null,
          download_url: download?.signedUrl || null
        }
      }))

      return NextResponse.json({ document: data, versions: versionsWithUrls, userRole: membership.role })
    }

    let query = adminSupabase
      .from('documents')
      .select('*, workspace:workspaces(name)')
      .eq('workspace_id', targetWorkspaceId)
      .eq('status', status)

    if (search) {
      query = query.ilike('original_filename', `%${search}%`)
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ documents: data, count, userRole: membership.role })
  } catch (error) {
    console.error('Documents GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    // Check admin role using admin client
    const adminSupabase = createAdminClient()
    
    // Fetch document first to get its workspace_id
    const { data: doc, error: docError } = await adminSupabase
      .from('documents')
      .select('workspace_id')
      .eq('id', documentId)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }

    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('user_id', user.id)
      .eq('workspace_id', doc.workspace_id)
      .single()

    if (!member || member.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required for this workspace' }, { status: 403 })
    }

    const workspaceId = doc.workspace_id

    // Archive document (don't delete provenance)
    const { error } = await adminSupabase
      .from('documents')
      .update({ status: 'archived', updated_at: new Date().toISOString() })
      .eq('id', documentId)

    if (error) throw error

    // Blockchain event
    await adminSupabase.rpc('append_blockchain_event', {
      p_workspace_id: workspaceId,
      p_event_type: 'document_archived',
      p_actor_id: user.id,
      p_document_id: documentId,
      p_payload: { document_id: documentId }
    })

    return NextResponse.json({ message: 'Document archived' })
  } catch (error) {
    console.error('Documents DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}