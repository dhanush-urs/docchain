import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

export const resetPasswordSchema = z.object({
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export const createWorkspaceSchema = z.object({
  name: z.string().min(1, 'Workspace name is required').max(100),
  slug: z.string().min(1, 'Slug is required').max(50).regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  description: z.string().max(500).optional(),
})

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const updateMemberRoleSchema = z.object({
  role: z.enum(['admin', 'editor', 'viewer']),
})

export const createGuestLinkSchema = z.object({
  workspaceId: z.string().uuid(),
  documentId: z.string().uuid().optional(),
  permissions: z.array(z.enum(['timeline', 'documents', 'versions', 'comments', 'blockchain'])).min(1),
  expiresAt: z.string().datetime().optional(),
})

export const commentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(5000),
  documentVersionId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
})

export const createDocumentSchema = z.object({
  workspaceId: z.string().uuid(),
  filename: z.string().min(1),
  originalFilename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().positive(),
  storagePath: z.string().min(1),
  sha256: z.string().length(64),
})

export const createVersionSchema = z.object({
  documentId: z.string().uuid(),
  versionNumber: z.number().positive(),
  sha256: z.string().length(64),
  storagePath: z.string().min(1),
  sizeBytes: z.number().positive(),
  changeSummary: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
export type CreateGuestLinkInput = z.infer<typeof createGuestLinkSchema>
export type CommentInput = z.infer<typeof commentSchema>
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type CreateVersionInput = z.infer<typeof createVersionSchema>