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

    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get('workspaceId')
    const documentId = searchParams.get('documentId')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = parseInt(searchParams.get('offset') || '0')
    const status = searchParams.get('status') || 'active'

    // Get membership automatically using admin client to bypass RLS recursion bug
    const adminSupabase = createAdminClient()

    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    const activeWorkspaceIdCookie = request.cookies.get('active_workspace_id')?.value
    const isGlobalAdmin = profile?.role === 'admin'


    const cookieStore = await cookies()
    const activeWsId = cookieStore.get('active_workspace_id')?.value

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
         if (ws) targetWorkspaceId = ws.id

      } else {
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
    }

    let userRole = isGlobalAdmin ? 'admin' : 'viewer'
    
    if (!isGlobalAdmin) {
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
      userRole = membership.role
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

      return NextResponse.json({ document: data, versions: versionsWithUrls, userRole, isGlobalAdmin })
    }

    let query = adminSupabase
      .from('documents')
      .select('*, workspace:workspaces(name)')
      .eq('workspace_id', targetWorkspaceId)
      .eq('status', status)

    if (search) {
      // Split search into words to match Google-like multi-word search
      const terms = search.trim().split(/\s+/).filter(Boolean)
      terms.forEach(term => {
        // We use inner OR to match across multiple fields, but AND across terms
        query = query.or(`original_filename.ilike.%${term}%,sha256.ilike.%${term}%`)
      })
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({ documents: data, count, userRole, isGlobalAdmin })
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

    if (user.email !== 'dhanushurs667@gmail.com') {
      return NextResponse.json({ error: 'Only dhanushurs667@gmail.com can delete documents.' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

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

    const workspaceId = doc.workspace_id

    // Fetch document versions to get storage paths
    const { data: versions } = await adminSupabase
      .from('document_versions')
      .select('storage_path')
      .eq('document_id', documentId)

    if (versions && versions.length > 0) {
      const pathsToDelete = versions.map(v => v.storage_path).filter(Boolean)
      if (pathsToDelete.length > 0) {
        // Delete files from Supabase Storage
        await adminSupabase.storage.from('documents').remove(pathsToDelete)
      }
    }

    // Delete document versions first to avoid FK constraint errors if cascade is not set
    await adminSupabase.from('document_versions').delete().eq('document_id', documentId)

    // Delete from timeline events so UI doesn't crash on missing doc
    await adminSupabase.from('timeline_events').delete().eq('metadata->>document_id', documentId)

    // Optionally delete from blockchain_blocks if we want the "block" gone
    // We match the payload->>documentId
    await adminSupabase.from('blockchain_blocks').delete().eq('payload->>documentId', documentId)

    // Delete the document completely from PostgreSQL
    const { error } = await adminSupabase
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('workspace_id', workspaceId)

    if (error) throw error

    return NextResponse.json({ message: 'Document deleted permanently' })
  } catch (error) {
    console.error('Documents DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}