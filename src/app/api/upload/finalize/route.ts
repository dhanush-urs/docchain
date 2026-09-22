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

    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      console.error('Auth error in finalize:', userError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()

    // Run Document Insert/Update AND Latest Block fetch in parallel
    const docPromise = !targetDocumentId ? adminSupabase
        .from('documents')
        .insert({
          id: documentId,
          workspace_id: workspaceId,
          filename: filename,
          original_filename: filename,
          mime_type: mimeType,
          size_bytes: size,
          storage_path: storagePath,
          sha256: sha256,
          uploaded_by: user.id,
          current_version: 1,
          status: 'active',
          visibility: 'public'
        }) : adminSupabase
        .from('documents')
        .update({
          filename: filename,
          original_filename: filename,
          mime_type: mimeType,
          size_bytes: size,
          storage_path: storagePath,
          sha256: sha256,
          current_version: nextVersion,
          updated_at: new Date().toISOString()
        })
        .eq('id', targetDocumentId)

    const latestBlockPromise = adminSupabase
      .from('blockchain_blocks')
      .select('block_hash, block_index')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const [docResult, latestBlockResult] = await Promise.all([docPromise, latestBlockPromise])

    if (docResult.error) {
      console.error('Error with document:', docResult.error)
      return NextResponse.json({ error: docResult.error.message }, { status: 500 })
    }

    // Now calculate block details
    const latestBlock = latestBlockResult.data
    const previousHash = latestBlock ? latestBlock.block_hash : '0000000000000000000000000000000000000000000000000000000000000000'
    const newIndex = latestBlock ? latestBlock.block_index + 1 : 0
    const timestamp = new Date().toISOString()
    const transactionString = `${workspaceId}:${documentId}:${sha256}:${timestamp}`
    const payload = { documentId, filename, fileSize: size, fileType: mimeType, fileHash: sha256, uploadedBy: user.id, version: nextVersion }
    const transactionHash = crypto.createHash('sha256').update(transactionString).digest('hex')
    const payloadHash = crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    const blockString = `${newIndex}:${previousHash}:${timestamp}:${transactionHash}:${payloadHash}`
    const blockHash = crypto.createHash('sha256').update(blockString).digest('hex')

    // Run Version Insert, Block Insert, and Timeline Insert in parallel!
    const versionPromise = adminSupabase
      .from('document_versions')
      .insert({
        document_id: documentId,
        version_number: nextVersion,
        storage_path: storagePath,
        size_bytes: size,
        sha256: sha256,
        uploaded_by: user.id,
        change_summary: changeSummary || (targetDocumentId ? 'New version uploaded' : 'Initial upload')
      })

    const blockPromise = adminSupabase
      .from('blockchain_blocks')
      .insert({
        workspace_id: workspaceId,
        block_index: newIndex,
        previous_hash: previousHash,
        block_hash: blockHash,
        timestamp: timestamp,
        transaction_hash: transactionHash,
        payload_hash: payloadHash,
        payload: payload
      })

    const timelinePromise = adminSupabase.from('timeline_events').insert({
        workspace_id: workspaceId,
        event_type: 'document_uploaded',
        actor_id: user.id,
        document_id: documentId,
        metadata: { filename, version: nextVersion, description: `Uploaded ${filename} (v${nextVersion})` }
    })

    const [versionResult, blockResult, timelineResult] = await Promise.all([versionPromise, blockPromise, timelinePromise])

    if (versionResult.error) console.error('Error inserting version:', versionResult.error)
    if (blockResult.error) console.error('Error inserting block:', blockResult.error)
    if (timelineResult.error) console.error('Error inserting timeline:', timelineResult.error)

    return NextResponse.json({ success: true, documentId })

  } catch (error: any) {
    console.error('Upload finalize error:', error)
    return NextResponse.json({ error: 'Internal server error: ' + error.message }, { status: 500 })
  }
}
