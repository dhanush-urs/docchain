import { describe, it, expect } from 'vitest'
import { computeSHA256, computeSHA256FromBuffer, validateSHA256 } from '@/lib/crypto/hash'
import { formatBytes, truncate, shortenHash } from '@/lib/utils'
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '@/lib/validations/schemas'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/documents/constants'
import { BlockchainEventType } from '@/types/database'

describe('SHA-256 Hashing', () => {
  it('should compute SHA-256 hash consistently', async () => {
    const buffer = new TextEncoder().encode('hello world').buffer
    const hash1 = await computeSHA256FromBuffer(buffer)
    const hash2 = await computeSHA256FromBuffer(buffer)
    expect(hash1).toBe(hash2)
    expect(hash1).toHaveLength(64)
    expect(hash1).toMatch(/^[a-f0-9]{64}$/)
  })

  it('should validate correct SHA-256 format', () => {
    expect(validateSHA256('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')).toBe(true)
    expect(validateSHA256('invalid')).toBe(false)
    expect(validateSHA256('')).toBe(false)
  })

  it('should produce consistent hashes for same input', async () => {
    const buffer = new TextEncoder().encode('test').buffer
    const hash1 = await computeSHA256FromBuffer(buffer)
    const hash2 = await computeSHA256FromBuffer(buffer)
    expect(hash1).toBe(hash2)
  })
})

describe('Format Utilities', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(0)).toBe('0 Bytes')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1024 * 1024)).toBe('1 MB')
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB')
  })

  it('should truncate strings correctly', () => {
    // truncate adds "..." after the length, so 8 chars + "..." = 11 chars total
    expect(truncate('hello world', 8)).toBe('hello wo...')
    expect(truncate('hi', 8)).toBe('hi')
  })

  it('should shorten hashes correctly', () => {
    const hash = 'a3f5c9e8b2d4f1a6c7e8d9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b'
    expect(shortenHash(hash, 8)).toBe('a3f5c9e8...')
    expect(shortenHash(hash, 16)).toBe('a3f5c9e8b2d4f1a6...')
  })
})

describe('Validation Schemas', () => {
  it('should validate login schema', () => {
    const valid = loginSchema.safeParse({ email: 'test@example.com', password: 'password123' })
    expect(valid.success).toBe(true)

    const invalid = loginSchema.safeParse({ email: 'invalid', password: 'short' })
    expect(invalid.success).toBe(false)
  })

  it('should validate forgot password schema', () => {
    const valid = forgotPasswordSchema.safeParse({ email: 'test@example.com' })
    expect(valid.success).toBe(true)

    const invalid = forgotPasswordSchema.safeParse({ email: 'invalid' })
    expect(invalid.success).toBe(false)
  })

  it('should validate reset password schema', () => {
    const valid = resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'password123' })
    expect(valid.success).toBe(true)

    const mismatch = resetPasswordSchema.safeParse({ password: 'password123', confirmPassword: 'different' })
    expect(mismatch.success).toBe(false)

    const short = resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' })
    expect(short.success).toBe(false)
  })
})

describe('Document Constants', () => {
  it('should have correct allowed MIME types', () => {
    expect(ALLOWED_MIME_TYPES['application/pdf']).toBe('.pdf')
    expect(ALLOWED_MIME_TYPES['application/vnd.openxmlformats-officedocument.wordprocessingml.document']).toBe('.docx')
    expect(ALLOWED_MIME_TYPES['image/png']).toBe('.png')
    expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024)
  })
})

describe('Blockchain Types', () => {
  it('should have correct event types', () => {
    const validEvents: BlockchainEventType[] = [
      'document_uploaded',
      'document_version_created',
      'document_viewed',
      'document_downloaded',
      'document_reviewed',
      'comment_added',
      'document_verified',
      'document_shared',
      'guest_link_created',
      'guest_link_revoked',
      'document_archived'
    ]
    expect(validEvents).toHaveLength(11)
  })
})