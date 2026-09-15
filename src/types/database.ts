export type MemberRole = 'admin' | 'editor' | 'viewer'

export type DocumentStatus = 'active' | 'archived' | 'deleted'

export type Visibility = 'public' | 'private'

export type BlockchainEventType =
  | 'document_uploaded'
  | 'document_version_created'
  | 'document_viewed'
  | 'document_downloaded'
  | 'document_reviewed'
  | 'comment_added'
  | 'document_verified'
  | 'document_shared'
  | 'guest_link_created'
  | 'guest_link_revoked'
  | 'document_archived'

export type GuestPermission =
  | 'timeline'
  | 'documents'
  | 'versions'
  | 'comments'
  | 'blockchain'

export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected'

export type VerificationResultStatus = 'authentic' | 'modified' | 'not_found'

export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  role: MemberRole
  created_at: string
  updated_at: string
}

export interface Workspace {
  id: string
  name: string
  slug: string
  description: string | null
  owner_id: string
  settings: Record<string, unknown>
  visibility: Visibility
  created_at: string
  updated_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: MemberRole
  invited_by: string | null
  joined_at: string
}

export interface Document {
  id: string
  workspace_id: string
  filename: string
  original_filename: string
  mime_type: string
  size_bytes: number
  storage_path: string
  sha256: string
  uploaded_by: string
  current_version: number
  status: DocumentStatus
  visibility: Visibility
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DocumentVersion {
  id: string
  document_id: string
  version_number: number
  sha256: string
  storage_path: string
  size_bytes: number
  uploaded_by: string
  change_summary: string | null
  created_at: string
}

export interface BlockchainTransaction {
  id: string
  workspace_id: string
  event_type: BlockchainEventType
  actor_id: string | null
  document_id: string | null
  document_version_id: string | null
  payload: Record<string, unknown>
  payload_hash: string
  transaction_hash: string
  created_at: string
}

export interface BlockchainBlock {
  id: string
  workspace_id: string
  block_index: number
  previous_hash: string
  timestamp: string
  transaction_hash: string
  payload_hash: string
  block_hash: string
  nonce: number
  created_at: string
}

export interface TimelineEvent {
  id: string
  workspace_id: string
  event_type: BlockchainEventType
  actor_id: string | null
  document_id: string | null
  document_version_id: string | null
  block_id: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface Comment {
  id: string
  workspace_id: string
  document_id: string
  document_version_id: string | null
  author_id: string
  content: string
  review_status: ReviewStatus
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface GuestLink {
  id: string
  token: string
  workspace_id: string
  document_id: string | null
  created_by: string
  permissions: GuestPermission[]
  expires_at: string | null
  revoked: boolean
  access_count: number
  created_at: string
}

export interface AuditLog {
  id: string
  workspace_id: string
  actor_id: string | null
  action: string
  target_type: string | null
  target_id: string | null
  metadata: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export interface Block {
  id: string
  workspaceId: string
  blockIndex: number
  previousHash: string
  timestamp: string
  transactionHash: string
  payloadHash: string
  blockHash: string
  nonce: number
}

export interface Transaction {
  id: string
  eventType: BlockchainEventType
  actorId: string
  documentId?: string
  documentVersionId?: string
  payload: Record<string, unknown>
  payloadHash: string
  transactionHash: string
}