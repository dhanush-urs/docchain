'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, FileSpreadsheet, FileImage, FileCode, FileArchive, CheckCircle, ArrowRight } from 'lucide-react'
import { cn, formatBytes, formatDistanceToNow } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface Document {
  id: string
  filename: string
  original_filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  current_version: number
  verified: boolean
  created_at: string
  workspaces?: {
    name: string
  }
  uploader?: {
    full_name: string | null
    email: string
  }
}

const MIME_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'application/pdf': FileText,
  'application/msword': FileText,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': FileText,
  'text/plain': FileText,
  'text/csv': FileSpreadsheet,
  'application/json': FileCode,
  'text/xml': FileCode,
  'application/xml': FileCode,
  'text/markdown': FileText,
  'application/vnd.ms-excel': FileSpreadsheet,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': FileSpreadsheet,
  'application/vnd.ms-powerpoint': FileText,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': FileText,
  'image/png': FileImage,
  'image/jpeg': FileImage,
  'image/webp': FileImage,
  'image/gif': FileImage,
  'image/svg+xml': FileImage,
  'application/zip': FileArchive,
}

// Function to generate a deterministic neon color based on file type
function getFileColor(mimeType: string) {
  if (mimeType.includes('pdf')) return 'text-red-500 bg-red-500/10 border-red-500/50'
  if (mimeType.includes('word') || mimeType.includes('document')) return 'text-blue-500 bg-blue-500/10 border-blue-500/50'
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'text-green-500 bg-green-500/10 border-green-500/50'
  if (mimeType.includes('json') || mimeType.includes('xml') || mimeType.includes('code')) return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50'
  if (mimeType.includes('image')) return 'text-purple-500 bg-purple-500/10 border-purple-500/50'
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'text-orange-500 bg-orange-500/10 border-orange-500/50'
  return 'text-slate-400 bg-slate-400/10 border-slate-400/50' // default text
}

// Function to get a short hex code from UUID
function getShortId(id: string) {
  return '#' + id.substring(0, 4).toUpperCase()
}

const ChainLinkCube = () => (
  <div className="flex items-center flex-shrink-0 px-2 sm:px-4">
    <div className="w-4 sm:w-8 h-[2px] bg-blue-500/50 shadow-[0_0_10px_rgba(0,100,255,0.8)]" />
    <div className="relative w-12 h-12 flex items-center justify-center">
      {/* Glowing Hexagon/Cube SVG */}
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(0,100,255,0.8)]">
        <polygon 
          points="50,5 90,25 90,75 50,95 10,75 10,25" 
          fill="rgba(0, 50, 200, 0.4)" 
          stroke="rgba(0, 150, 255, 0.8)" 
          strokeWidth="4" 
        />
        <polyline points="10,25 50,50 90,25" fill="none" stroke="rgba(0, 150, 255, 0.5)" strokeWidth="3" />
        <line x1="50" y1="50" x2="50" y2="95" stroke="rgba(0, 150, 255, 0.5)" strokeWidth="3" />
        {/* Inner glow core */}
        <circle cx="50" cy="50" r="10" fill="rgba(100, 200, 255, 0.8)" filter="blur(4px)" />
      </svg>
    </div>
    <div className="w-4 sm:w-8 h-[2px] bg-blue-500/50 shadow-[0_0_10px_rgba(0,100,255,0.8)]" />
  </div>
)

export function PublicDocumentList({ searchQuery = '' }: { searchQuery?: string }) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  useEffect(() => {
    async function fetchDocs() {
      // Setup realtime subscription with a unique channel name to avoid Strict Mode collisions
      const channelId = `public-docs-${Date.now()}`
      const channel = supabase.channel(channelId)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: "visibility=eq.public"
        }, () => {
          // Re-fetch when something changes
          loadDocs()
        })
        .subscribe()

      await loadDocs()

      return () => {
        supabase.removeChannel(channel)
      }
    }

    async function loadDocs() {
      try {
        const response = await fetch('/api/documents/public')
        if (!response.ok) throw new Error('Failed to fetch public documents')
        
        const { documents: data } = await response.json()
        
        if (data) {
          setDocuments(data)
        }
      } catch (err) {
        console.error('Failed to load public documents:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchDocs()
  }, [])

  if (loading) {
    return (
      <div className="flex gap-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center">
            <div className="w-64 h-80 bg-blue-900/20 border border-blue-500/30 rounded-xl" />
            {i !== 3 && <div className="w-20 h-10 bg-blue-900/20 mx-4" />}
          </div>
        ))}
      </div>
    )
  }

  const filteredDocuments = documents.filter(doc => {
    const originalFilename = doc.original_filename || ''
    const workspaceName = doc.workspaces?.name || ''
    const sha256 = doc.sha256 || ''
    const searchWords = (searchQuery || '').toLowerCase().split(/\s+/).filter(Boolean)
    
    if (searchWords.length === 0) return true
    
    // Check if ALL words match somewhere in the document's searchable fields (AND logic like Google)
    return searchWords.every(word => 
      originalFilename.toLowerCase().includes(word) ||
      sha256.toLowerCase().includes(word)
    )
  })

  const workspaces = Array.from(new Set(filteredDocuments.map(doc => doc.workspaces?.name || 'Unknown Branch')))

  if (filteredDocuments.length === 0) {
    return (
      <div className="flex w-full items-center justify-center text-blue-400/50 italic h-64">
        {searchQuery ? `No documents match "${searchQuery}"` : 'No public documents found in the chain yet.'}
      </div>
    )
  }


  const groupedDocs = workspaces.reduce((acc, wsName) => {
    acc[wsName] = filteredDocuments.filter(doc => (doc.workspaces?.name || 'Unknown Branch') === wsName)
    return acc
  }, {} as Record<string, Document[]>)

  return (
    <div className="flex flex-col gap-24 min-w-max pb-32">
      {workspaces.map((wsName) => {
        const wsDocs = groupedDocs[wsName]
        return (
          <div key={wsName} className="flex flex-col">
            <div className="sticky left-0 mb-8 flex items-center gap-3">
              <div className="w-2 h-8 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(0,100,255,0.8)]"></div>
              <h2 className="text-3xl font-bold text-white drop-shadow-[0_0_15px_rgba(0,100,255,0.5)]">
                {wsName}
              </h2>
              <span className="text-blue-400/50 text-sm ml-2 font-mono uppercase tracking-widest px-3 py-1 bg-blue-950/40 rounded-full border border-blue-900/30">
                Branch
              </span>
            </div>
            
            <div className="flex items-center min-w-max">
              {wsDocs.map((doc, index) => {
                const Icon = MIME_ICONS[doc.mime_type] || FileText
                const colorClass = getFileColor(doc.mime_type)

                return (
                  <div key={doc.id} className="flex items-center">
                    {/* Document Card */}
                    <div 
                      className="w-64 sm:w-72 bg-[#020817]/80 backdrop-blur-md rounded-xl p-5 border border-blue-500/40 shadow-[0_0_20px_rgba(0,100,255,0.2)] hover:shadow-[0_0_30px_rgba(0,150,255,0.4)] transition-all flex flex-col justify-between"
                      style={{ minHeight: '340px' }}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-mono text-blue-300/70">{getShortId(doc.id)}</span>
                          {doc.verified && (
                            <div className="w-6 h-6 rounded-full border-2 border-[#00ffcc] flex items-center justify-center shadow-[0_0_10px_rgba(0,255,204,0.5)]">
                              <CheckCircle className="w-4 h-4 text-[#00ffcc]" />
                            </div>
                          )}
                        </div>

                        <div className="mb-4">
                          <div className={cn("w-12 h-14 rounded flex items-center justify-center mb-3 border", colorClass)}>
                            <Icon className="w-6 h-6" />
                          </div>
                          <h3 className="font-semibold text-lg text-white line-clamp-2 leading-tight mb-2">
                            {doc.original_filename}
                          </h3>
                          <p className="text-sm text-blue-200/60 mb-1">{doc.workspaces?.name}</p>
                          <p className="text-sm text-blue-200/60 mb-1">
                            {new Date(doc.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <p className="text-sm text-blue-300/80 truncate">
                            by {doc.uploader?.full_name || doc.uploader?.email || 'Unknown'}
                          </p>
                        </div>
                      </div>

                      <div>
                        <div className="font-mono text-xs text-blue-300/50 mb-4 bg-blue-950/40 p-2 rounded truncate border border-blue-900/30">
                          {doc.sha256}
                        </div>
                        <a href={`/api/documents/public/download?id=${doc.id}`} target="_blank" rel="noopener noreferrer">
                          <Button 
                            variant="outline" 
                            className="w-full justify-center bg-transparent border-blue-500/50 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 shadow-[inset_0_0_10px_rgba(0,100,255,0.2)]"
                          >
                            View <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </a>
                      </div>
                    </div>

                    {/* Chain Link Cube (unless it's the last item) */}
                    {index < wsDocs.length - 1 && <ChainLinkCube />}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
