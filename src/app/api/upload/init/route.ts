import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { filename, targetDocumentId, activeWorkspaceId } = await request.json()

    // 1. Auth check
    const cookieStore = await cookies()
    const supabaseCookie = cookieStore.get('sb-jzrzobdyvxmhlrjmmayk-auth-token')
    
    if (!supabaseCookie) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const authData = JSON.parse(supabaseCookie.value)
    const token = authData[0]
    
    if (!token) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 })
    }

    // Initialize Admin Supabase Client for creating signed URL
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Verify user
    const { data: { user }, error: userError } = await adminSupabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Resolve Workspace
    const { data: profile } = await adminSupabase.from('profiles').select('role').eq('id', user.id).single()
    const isGlobalAdmin = profile?.role === 'admin'

    let workspaceId = activeWorkspaceId

    if (targetDocumentId) {
      // Fetch existing document workspace
      const { data: existingDoc } = await adminSupabase
        .from('documents')
        .select('workspace_id, current_version')
        .eq('id', targetDocumentId)
        .single()
        
      if (!existingDoc) {
        return NextResponse.json({ error: 'Target document not found' }, { status: 404 })
      }
      
      workspaceId = existingDoc.workspace_id
      
      if (!isGlobalAdmin) {
        const { data: member } = await adminSupabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single()
          
        if (!member || !['admin', 'editor'].includes(member.role)) {
          return NextResponse.json({ error: 'Insufficient permissions for this document' }, { status: 403 })
        }
      }
    } else {
      if (isGlobalAdmin) {
         let ws = null;
         if (activeWorkspaceId) {
           const { data } = await adminSupabase.from('workspaces').select('id').eq('id', activeWorkspaceId).single()
           ws = data
         }
         if (!ws) {
           const { data } = await adminSupabase.from('workspaces').select('id').limit(1).single()
           ws = data
         }
         if (!ws) {
           return NextResponse.json({ error: 'No workspace found in the system' }, { status: 500 })
         }
         workspaceId = ws.id
      } else {
        const { data: member } = await adminSupabase
          .from('workspace_members')
          .select('workspace_id, role')
          .eq('user_id', user.id)
          .in('role', ['admin', 'editor'])
          .limit(1)
          .single()

        if (!member) {
          return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
        }
        workspaceId = member.workspace_id
      }
    }

    // 3. Generate storage path and next version
    const documentId = targetDocumentId || crypto.randomUUID()
    
    let nextVersion = 1
    if (targetDocumentId) {
       const { data: existingDoc } = await adminSupabase.from('documents').select('current_version').eq('id', targetDocumentId).single()
       if (existingDoc) nextVersion = existingDoc.current_version + 1
    }

    const sanitizedFileName = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${workspaceId}/${documentId}/${nextVersion}_${sanitizedFileName}`

    // 4. Create signed URL
    const { data: signedData, error: signedError } = await adminSupabase.storage
      .from('documents')
      .createSignedUploadUrl(storagePath)

    if (signedError || !signedData) {
      console.error('Error creating signed URL:', signedError)
      return NextResponse.json({ error: 'Failed to generate upload URL' }, { status: 500 })
    }

    return NextResponse.json({
      signedUrl: signedData.signedUrl,
      token: signedData.token, // This token allows the client to PUT to the signedUrl
      storagePath,
      workspaceId,
      documentId,
      nextVersion
    })

  } catch (error) {
    console.error('Upload init error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
