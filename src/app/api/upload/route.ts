import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const changeSummary = formData.get('changeSummary') as string
    const clientSha256 = formData.get('clientSha256') as string
    const targetDocumentId = formData.get('documentId') as string

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 })
    }

    // Check permissions using admin client
    const adminSupabase = createAdminClient()
    
    // Get user global profile
    const { data: profile } = await adminSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const activeWorkspaceIdCookie = request.cookies.get('active_workspace_id')?.value
    const isGlobalAdmin = profile?.role === 'admin'


    const cookieStore = await cookies()
    const activeWsId = cookieStore.get('active_workspace_id')?.value

    let workspaceId: string
    let memberRole: string = 'admin'

    if (targetDocumentId) {
      // If updating, get the document's workspace
      const { data: existingDoc } = await adminSupabase
        .from('documents')
        .select('workspace_id')
        .eq('id', targetDocumentId)
        .single()
        
      if (!existingDoc) {
        return NextResponse.json({ error: 'Target document not found' }, { status: 404 })
      }
      
      workspaceId = existingDoc.workspace_id
      
      if (!isGlobalAdmin) {
        // Check permissions for this specific workspace
        const { data: member } = await adminSupabase
          .from('workspace_members')
          .select('role')
          .eq('user_id', user.id)
          .eq('workspace_id', workspaceId)
          .single()
          
        if (!member || !['admin', 'editor'].includes(member.role)) {
          return NextResponse.json({ error: 'Insufficient permissions for this document' }, { status: 403 })
        }
        memberRole = member.role
      }
    } else {
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
           return NextResponse.json({ error: 'No workspace found in the system' }, { status: 500 })
         }
         workspaceId = ws.id

      } else {
        // If new upload, use the first available admin/editor workspace
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
        memberRole = member.role
      }
    }

    // Check file size (50MB limit)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 50MB limit' }, { status: 400 })
    }

    // Convert file to array buffer for hashing
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    
    // Calculate SHA-256 if not provided
    let sha256 = clientSha256
    if (!sha256) {
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      sha256 = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')
    }

    const documentId = targetDocumentId || crypto.randomUUID()
    
    // Determine next version number
    let nextVersion = 1
    if (targetDocumentId) {
       const { data: existingDoc } = await adminSupabase.from('documents').select('current_version').eq('id', targetDocumentId).single()
       if (existingDoc) nextVersion = existingDoc.current_version + 1
    }

    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${workspaceId}/${documentId}/${nextVersion}_${sanitizedFileName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await adminSupabase.storage
      .from('documents')
      .upload(storagePath, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      })

    if (uploadError) {
      return NextResponse.json({ error: 'Storage upload failed: ' + uploadError.message }, { status: 500 })
    }

    if (!targetDocumentId) {
      // Create document record
      const { data: document, error: docError } = await adminSupabase
        .from('documents')
        .insert({
          id: documentId,
          workspace_id: workspaceId,
          filename: file.name,
          original_filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_path: storagePath,
          sha256,
          uploaded_by: user.id,
          current_version: 1,
          status: 'active',
          visibility: 'public'
        })
        .select()
        .single()

      if (docError) {
        await adminSupabase.storage.from('documents').remove([storagePath])
        return NextResponse.json({ error: 'Document creation failed: ' + docError.message }, { status: 500 })
      }
    } else {
      // Update document record
      const { error: updateError } = await adminSupabase
        .from('documents')
        .update({
          filename: file.name,
          original_filename: file.name,
          mime_type: file.type || "application/octet-stream",
          size_bytes: file.size,
          storage_path: storagePath,
          sha256,
          uploaded_by: user.id,
          current_version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (updateError) {
        await adminSupabase.storage.from('documents').remove([storagePath])
        return NextResponse.json({ error: 'Document update failed: ' + updateError.message }, { status: 500 })
      }
    }

    // Create version
    const { error: versionError } = await adminSupabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: nextVersion,
        sha256,
        storage_path: storagePath,
        size_bytes: file.size,
        uploaded_by: user.id,
        change_summary: changeSummary || 'Initial upload'
      })

    if (versionError) {
      return NextResponse.json({ error: 'Version creation failed: ' + versionError.message }, { status: 500 })
    }

    // Append blockchain event
    const payload = {
      document_id: documentId,
      filename: file.name,
      version: nextVersion,
      sha256,
      size_bytes: file.size,
      uploaded_by: user.id
    }

    // Append blockchain event manually (bypassing broken RPC)
    const transactionString = `document_uploaded${user.id}${documentId}${JSON.stringify(payload)}`
    const transactionHash = crypto.createHash('sha256').update(transactionString).digest('hex')
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

    // Get latest block
    const { data: latestBlock } = await adminSupabase
      .from('blockchain_blocks')
      .select('block_hash, block_index')
      .eq('workspace_id', workspaceId)
      .order('block_index', { ascending: false })
      .limit(1)
      .single()

    const previousHash = latestBlock?.block_hash || '0'
    const blockIndex = (latestBlock?.block_index ?? -1) + 1
    
    // Simple PoW
    let nonce = 0
    let blockHash = ''
    const timestamp = new Date().toISOString()
    while (true) {
      const blockString = `${previousHash}${transactionHash}${timestamp}${nonce}`
      blockHash = crypto.createHash('sha256').update(blockString).digest('hex')
      if (blockHash.startsWith('0000')) break
      nonce++
    }

    // Insert block
    const { data: block } = await adminSupabase
      .from('blockchain_blocks')
      .insert({
        workspace_id: workspaceId,
        block_index: blockIndex,
        previous_hash: previousHash,
        timestamp,
        transaction_hash: transactionHash,
        payload_hash: payloadHash,
        block_hash: blockHash,
        nonce
      })
      .select('id')
      .single()

    // Insert timeline event
    if (block) {
      const { error: timelineError } = await adminSupabase.from('timeline_events').insert({
        workspace_id: workspaceId,
        event_type: 'document_uploaded',
        actor_id: user.id,
        document_id: documentId,
        metadata: payload,
        block_id: block.id,
      })
      if (timelineError) {
        console.error('Timeline error:', timelineError)
      }
    }

    return NextResponse.json({
      documentId,
      sha256,
      version: nextVersion,
      message: 'Document uploaded successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}