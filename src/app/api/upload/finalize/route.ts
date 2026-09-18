import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: Request) {
  try {
    const { 
      filename, 
      mimeType, 
      size, 
      sha256, 
      changeSummary, 
      targetDocumentId, 
      storagePath, 
      workspaceId, 
      documentId, 
      nextVersion 
    } = await request.json()

    // 1. Auth check using proper SSR client
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error in finalize:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    if (!targetDocumentId) {
      // Create document record
      const { data: document, error: docError } = await adminSupabase
        .from('documents')
        .insert({
          id: documentId,
          workspace_id: workspaceId,
          filename: filename,
          original_filename: filename,
          mime_type: mimeType || "application/octet-stream",
          size_bytes: size,
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
        console.error('Document creation failed:', docError)
        return NextResponse.json({ error: 'Document creation failed: ' + docError.message }, { status: 500 })
      }
    } else {
      // Update document record
      const { error: updateError } = await adminSupabase
        .from('documents')
        .update({
          filename: filename,
          original_filename: filename,
          mime_type: mimeType || "application/octet-stream",
          size_bytes: size,
          storage_path: storagePath,
          sha256,
          uploaded_by: user.id,
          current_version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', documentId)

      if (updateError) {
        console.error('Document update failed:', updateError)
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
        size_bytes: size,
        uploaded_by: user.id,
        change_summary: changeSummary || 'Initial upload'
      })

    if (versionError) {
      console.error('Version creation failed:', versionError)
      return NextResponse.json({ error: 'Version creation failed: ' + versionError.message }, { status: 500 })
    }

    // Append blockchain event
    const payload = {
      document_id: documentId,
      filename: filename,
      version: nextVersion,
      sha256,
      size_bytes: size,
      uploaded_by: user.id
    }

    const transactionString = `document_uploaded${user.id}${documentId}${JSON.stringify(payload)}`
    const transactionHash = crypto.createHash('sha256').update(transactionString).digest('hex')
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')

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
    const { data: block, error: blockError } = await adminSupabase
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

    if (blockError) {
       console.error('Block creation failed:', blockError)
    }

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

  } catch (error: any) {
    console.error('Upload finalize error:', error)
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}
