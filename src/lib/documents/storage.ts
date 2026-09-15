import { createClient } from '@/lib/supabase/client'
import { computeSHA256 } from '@/lib/crypto/hash'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './constants'

export async function getSignedUploadUrl(
  workspaceId: string,
  documentId: string,
  filename: string,
  version: number
): Promise<{ uploadUrl: string; path: string }> {
  const supabase = createClient()
  const path = `${workspaceId}/${documentId}/${version}_${filename}`

  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUploadUrl(path)

  if (error) throw new Error(`Failed to create upload URL: ${error.message}`)
  if (!data?.signedUrl) throw new Error('No upload URL returned')

  return { uploadUrl: data.signedUrl, path }
}

export async function uploadFileToStorage(
  uploadUrl: string,
  file: File
): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }
}

export async function getSignedDownloadUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.storage
    .from('documents')
    .createSignedUrl(path, expiresIn)

  if (error) throw new Error(`Failed to create download URL: ${error.message}`)
  if (!data?.signedUrl) throw new Error('No download URL returned')

  return data.signedUrl
}

export async function deleteFileFromStorage(path: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.storage.from('documents').remove([path])
  if (error) throw new Error(`Failed to delete file: ${error.message}`)
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_MIME_TYPES[file.type as keyof typeof ALLOWED_MIME_TYPES]) {
    return { valid: false, error: `File type ${file.type} is not allowed` }
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` }
  }

  return { valid: true }
}

export async function processDocumentUpload(
  workspaceId: string,
  documentId: string,
  file: File,
  version: number
): Promise<{ sha256: string; path: string }> {
  const validation = validateFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  const sha256 = await computeSHA256(file)
  const { uploadUrl, path } = await getSignedUploadUrl(workspaceId, documentId, file.name, version)
  await uploadFileToStorage(uploadUrl, file)

  return { sha256, path }
}