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
    const documentId = searchParams.get('documentId')

    if (!documentId) {
      return NextResponse.json({ error: 'Missing documentId' }, { status: 400 })
    }

    // Use admin client to bypass RLS infinite recursion
    const adminSupabase = createAdminClient()
    
    // Fetch document first to get its workspace_id
    const { data: doc, error } = await adminSupabase
      .from('documents')
      .select('storage_path, original_filename, mime_type, workspace_id')
      .eq('id', documentId)
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 })
    }
    
    // Check membership for this specific workspace
    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .eq('workspace_id', doc.workspace_id)
      .limit(1)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this workspace' }, { status: 403 })
    }

    // Generate signed URL
    const { data: signedUrlData, error: signError } = await adminSupabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60, { download: doc.original_filename })

    if (signError || !signedUrlData) {
      throw signError || new Error('Failed to sign URL')
    }

    return NextResponse.json({ signedUrl: signedUrlData.signedUrl })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
