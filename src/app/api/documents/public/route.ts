import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse, NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const adminSupabase = createAdminClient()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (id) {
      // Fetch single document
      const { data, error } = await adminSupabase
        .from('documents')
        .select('*, workspaces(name), uploader:profiles!documents_uploaded_by_fkey(full_name, email)')
        .eq('id', id)
        .eq('visibility', 'public')
        .eq('status', 'active')
        .single()

      if (error || !data) {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 })
      }

      // Fetch versions
      const { data: versionsData } = await adminSupabase
        .from('document_versions')
        .select('*')
        .eq('document_id', id)
        .order('version_number', { ascending: false })

      return NextResponse.json({ document: data, versions: versionsData || [] })
    }

    // Fetch list of documents
    const { data, error } = await adminSupabase
      .from('documents')
      .select('*, workspaces(name), uploader:profiles!documents_uploaded_by_fkey(full_name, email), document_versions(change_summary, version_number)')
      .eq('visibility', 'public')
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1000)

    if (error) {
      console.error('Error fetching public documents:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ documents: data || [] })
  } catch (error) {
    console.error('Public documents API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
