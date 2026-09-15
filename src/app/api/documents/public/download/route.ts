import { createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()
    
    // Verify it's a public document
    const { data: doc, error } = await adminSupabase
      .from('documents')
      .select('storage_path, original_filename')
      .eq('id', id)
      .eq('visibility', 'public')
      .eq('status', 'active')
      .single()

    if (error || !doc) {
      return NextResponse.json({ error: 'Document not found or not public' }, { status: 404 })
    }

    // Generate signed URL
    const { data: signedUrlData, error: signError } = await adminSupabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60)

    if (signError || !signedUrlData) {
      throw signError || new Error('Failed to sign URL')
    }

    // Redirect the browser directly to the signed URL to open/download the file
    return NextResponse.redirect(signedUrlData.signedUrl)
  } catch (error) {
    console.error('Public download error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
