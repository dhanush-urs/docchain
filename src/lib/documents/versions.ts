import { createClient } from '@/lib/supabase/client'
import type { Document, DocumentVersion } from '@/types/database'

export async function createDocumentVersion(
  documentId: string,
  versionNumber: number,
  sha256: string,
  storagePath: string,
  sizeBytes: number,
  changeSummary?: string
): Promise<DocumentVersion> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: versionNumber,
      sha256,
      storage_path: storagePath,
      size_bytes: sizeBytes,
      change_summary: changeSummary || null,
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create version: ${error.message}`)
  return data
}

export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })

  if (error) throw new Error(`Failed to fetch versions: ${error.message}`)
  return data || []
}

export async function getDocumentVersion(documentId: string, versionNumber: number): Promise<DocumentVersion | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .eq('version_number', versionNumber)
    .single()

  if (error) return null
  return data
}

export async function incrementDocumentVersion(documentId: string): Promise<void> {
  const supabase = createClient()

  const { error } = await supabase.rpc('increment_document_version', { doc_id: documentId })
  if (error) throw new Error(`Failed to increment version: ${error.message}`)
}

export async function getDocumentWithVersions(documentId: string): Promise<Document & { versions: DocumentVersion[] }> {
  const supabase = createClient()

  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  if (docError) throw new Error(`Failed to fetch document: ${docError.message}`)

  const versions = await getDocumentVersions(documentId)

  return { ...document, versions }
}