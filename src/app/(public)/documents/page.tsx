'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, FileSpreadsheet, FileImage, FileCode, FileArchive, Search, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn, formatBytes, formatDistanceToNow } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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
  workspace_name: string
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

const LIMIT = 12

const MIME_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'application/pdf', label: 'PDF' },
  { value: 'application/msword', label: 'Word' },
  { value: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word (docx)' },
  { value: 'text/plain', label: 'Text' },
  { value: 'text/csv', label: 'CSV' },
  { value: 'application/json', label: 'JSON' },
  { value: 'text/xml', label: 'XML' },
  { value: 'application/xml', label: 'XML' },
  { value: 'text/markdown', label: 'Markdown' },
  { value: 'application/vnd.ms-excel', label: 'Excel' },
  { value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel (xlsx)' },
  { value: 'application/vnd.ms-powerpoint', label: 'PowerPoint' },
  { value: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', label: 'PowerPoint (pptx)' },
  { value: 'image/png', label: 'PNG' },
  { value: 'image/jpeg', label: 'JPEG' },
  { value: 'image/webp', label: 'WebP' },
  { value: 'image/gif', label: 'GIF' },
  { value: 'image/svg+xml', label: 'SVG' },
  { value: 'application/zip', label: 'ZIP' },
]

export default function PublicDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  const supabase = createClient()

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('documents')
        .select('*, workspaces(name)', { count: 'exact' })
        .eq('visibility', 'public')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range((page - 1) * LIMIT, page * LIMIT - 1)

      if (search) {
        query = query.ilike('original_filename', `%${search}%`)
      }
      if (typeFilter) {
        query = query.eq('mime_type', typeFilter)
      }

      const { data, error, count } = await query

      if (error) throw error

      const docs = (data || []).map((d: any) => ({
        ...d,
        workspace_name: d.workspaces?.name || 'Unknown',
      }))

      setDocuments(docs)
      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / LIMIT))
    } catch (err) {
      setError((err as any)?.message || 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [page, search, typeFilter])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="space-y-8">
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold">Public Documents</h1>
              <div className="flex gap-2">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-10 w-32" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
          <Card className="glass max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Failed to load documents</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={fetchDocuments}>
                Try Again
              </Button>
            </CardContent>
          </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Public Document Registry</h1>
          <p className="text-muted-foreground">Browse publicly shared documents with verified provenance</p>
        </div>

        <form onSubmit={(e) => { e.preventDefault(); setPage(1); fetchDocuments() }} className="mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label htmlFor="search" className="sr-only">Search documents</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="search"
                  placeholder="Search documents by name..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v ?? '')}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                {MIME_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="submit" className="gap-2">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>
        </form>

        {documents.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No documents found</h3>
            <p className="text-muted-foreground">
              {search || typeFilter
                ? 'Try adjusting your search or filters'
                : 'No public documents available yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {documents.map((doc) => {
                const Icon = MIME_ICONS[doc.mime_type] || FileText
                return (
                  <div key={doc.id} className="glass rounded-xl p-5 hover:border-primary/50 transition-colors group" data-testid="document-card">
                    <div className="flex items-start justify-between mb-3">
                      <Icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
                      <Badge variant={doc.verified ? 'default' : 'secondary'} className="text-xs">
                        {doc.verified ? 'Verified' : 'Pending'}
                      </Badge>
                    </div>
                    <h3 className="font-medium text-lg truncate mb-1">{doc.original_filename}</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      v{doc.current_version} • {formatBytes(doc.size_bytes)}
                    </p>
                    <div className="text-xs font-mono text-muted-foreground/70 mb-3">
                      {doc.sha256.slice(0, 16)}...
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{doc.workspace_name}</span>
                      <span>{formatDistanceToNow(doc.created_at)} ago</span>
                    </div>
                  </div>
                )
              })}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
      )}
    </div>
  )
}