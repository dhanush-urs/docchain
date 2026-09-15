import { vi } from 'vitest'

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Supabase
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn(),
        download: vi.fn(),
        remove: vi.fn(),
        createSignedUrl: vi.fn(),
        createSignedUploadUrl: vi.fn(),
      })),
    },
    rpc: vi.fn(),
    channel: vi.fn(() => ({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
    })),
  }),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

// Simple SHA-256 implementation for testing
async function sha256(data: ArrayBuffer): Promise<ArrayBuffer> {
  const msgUint8 = new Uint8Array(data)
  const msgString = new TextDecoder().decode(msgUint8)
  const encoder = new TextEncoder()
  const data2 = encoder.encode(msgString)
  
  // Use a simple hash for testing - in real code this would be actual SHA-256
  const hash = await crypto.subtle.digest('SHA-256', data2)
  return hash
}

// Mock crypto.subtle for tests
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: async (algorithm: string, data: ArrayBuffer) => {
        if (algorithm === 'SHA-256') {
          // For testing, use a simple but deterministic hash
          const view = new Uint8Array(data)
          let hash = 0
          for (let i = 0; i < view.length; i++) {
            hash = ((hash << 5) - hash) + view[i]
            hash = hash & hash
          }
          // Convert to 32-byte hash for SHA-256 compatibility
          const hashArray = new Uint8Array(32)
          for (let i = 0; i < 32; i++) {
            hashArray[i] = (hash >> (i * 8)) & 0xff
          }
          return hashArray.buffer
        }
        return new ArrayBuffer(0)
      },
    },
    randomUUID: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
  },
})

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})