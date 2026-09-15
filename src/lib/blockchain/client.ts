import { BlockData, TransactionData, ChainValidationResult, BlockPayload } from './types'

const encoder = new TextEncoder()

async function sha256(data: string): Promise<string> {
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data))
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function calculatePayloadHash(payload: Record<string, unknown>): Promise<string> {
  return sha256(JSON.stringify(payload))
}

export function calculateTransactionHash(
  eventType: string,
  actorId: string,
  documentId: string | undefined,
  payload: Record<string, unknown>
): Promise<string> {
  const data = eventType + actorId + (documentId || '') + JSON.stringify(payload)
  return sha256(data)
}

export function calculateBlockHash(
  previousHash: string,
  timestamp: string,
  transactionHash: string,
  payloadHash: string,
  nonce: number
): Promise<string> {
  const data = previousHash + timestamp + transactionHash + payloadHash + nonce.toString()
  return sha256(data)
}

export async function validateBlock(
  block: BlockData,
  previousHash: string
): Promise<{ isValid: boolean; expectedHash: string }> {
  const expectedHash = await calculateBlockHash(
    previousHash,
    block.timestamp,
    block.transactionHash,
    block.payloadHash,
    block.nonce
  )
  return {
    isValid: expectedHash === block.blockHash,
    expectedHash,
  }
}

export async function validateChain(blocks: BlockData[]): Promise<ChainValidationResult[]> {
  const results: ChainValidationResult[] = []
  let previousHash = '0'

  for (const block of blocks) {
    const { isValid, expectedHash } = await validateBlock(block, previousHash)
    results.push({
      blockIndex: block.blockIndex,
      isValid,
      expectedHash,
      actualHash: block.blockHash,
    })
    previousHash = block.blockHash
  }

  return results
}

export async function verifyTransaction(
  transaction: TransactionData,
  payload: Record<string, unknown>
): Promise<boolean> {
  const payloadHash = await calculatePayloadHash(payload)
  if (payloadHash !== transaction.payloadHash) return false

  const transactionHash = await calculateTransactionHash(
    transaction.eventType,
    transaction.actorId,
    transaction.documentId || undefined,
    payload
  )
  return transactionHash === transaction.transactionHash
}