import { BlockchainEventType } from '@/types/database'

export interface BlockPayload {
  eventType: BlockchainEventType
  actorId: string
  documentId?: string
  documentVersionId?: string
  metadata: Record<string, unknown>
  timestamp: string
}

export interface TransactionData {
  id: string
  eventType: BlockchainEventType
  actorId: string
  documentId?: string
  documentVersionId?: string
  payload: Record<string, unknown>
  payloadHash: string
  transactionHash: string
  createdAt: string
}

export interface BlockData {
  id: string
  workspaceId: string
  blockIndex: number
  previousHash: string
  timestamp: string
  transactionHash: string
  payloadHash: string
  blockHash: string
  nonce: number
  createdAt: string
}

export interface ChainValidationResult {
  blockIndex: number
  isValid: boolean
  expectedHash: string
  actualHash: string
}