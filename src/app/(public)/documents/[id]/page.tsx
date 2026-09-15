'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { FileText, Download, Eye, Copy, CheckCircle, AlertCircle, Clock, FileImage, FileSpreadsheet, FileCode, FileArchive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatBytes, formatDistanceToNow } from '@/lib/utils'
import { Footer } from '@/components/layout/Footer'

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
  workspace_id: string
  uploaded_by: string
  status: string
  visibility: string
  workspace_name?: string
}

interface DocumentVersion {
  id: string
  version_number: number
  sha256: string
  size_bytes: number
  storage_path: string
  change_summary: string | null
  created_at: string
  uploaded_by: string
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

export default function PublicDocumentDetailPage() {
  const params = useParams()
  const documentId = params.id as string

  const [document, setDocument] = useState<Document | null>(null)
  const [versions, setVersions] = useState<DocumentVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const fetchDocument = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/documents/public?id=${documentId}`)
        if (!response.ok) {
          throw new Error('Document not found or not publicly accessible')
        }

        const { document: data, versions: versionsData } = await response.json()

        const doc: Document = {
          ...data,
          workspace_name: data.workspaces?.name,
        }
        setDocument(doc)
        setVersions(versionsData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }

    if (documentId) {
      fetchDocument()
    }
  }, [documentId])

  const copyHash = async () => {
    if (document?.sha256) {
      await navigator.clipboard.writeText(document.sha256)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-12 w-1/2" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !document) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12">
          <Card className="glass max-w-2xl mx-auto">
            <CardContent className="pt-6 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Document Not Found</h3>
              <p className="text-muted-foreground mb-4">{error || 'Document not found or not publicly accessible'}</p>
              <a href="/documents" className="text-primary hover:underline">
                Back to Documents
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const Icon = MIME_ICONS[document.mime_type] || FileText

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Document Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className={cn(
                'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
                document.mime_type.startsWith('image/') ? 'bg-green-500/10' :
                document.mime_type === 'application/pdf' ? 'bg-red-500/10' :
                'bg-blue-500/10'
              )}>
                <Icon className={cn(
                  'h-8 w-8',
                  document.mime_type.startsWith('image/') ? 'text-green-500' :
                  document.mime_type === 'application/pdf' ? 'text-red-500' :
                  'text-blue-500'
                )} />
              </div>
              <div>
                <h1 className="text-2xl font-bold truncate max-w-md" data-testid="document-title">{document.original_filename}</h1>
                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                  <Badge variant={document.verified ? 'default' : 'secondary'}>
                    {document.verified ? (
                      <>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        <span>Verified</span>
                      </>
                    ) : (
                      <>
                        <Clock className="h-3 w-3 mr-1" />
                        <span>Pending</span>
                      </>
                    )}
                  </Badge>
                  <span className="font-mono text-xs">{document.sha256.slice(0, 16)}...</span>
                  <span>v{document.current_version}</span>
                  <span>{formatBytes(document.size_bytes)}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={copyHash}>
                <Copy className="h-4 w-4 mr-2" />
                {copied ? 'Copied!' : 'Copy Hash'}
              </Button>
              <Button variant="outline">
                <a href={`/verify?hash=${document.sha256}`}>
                  <Eye className="h-4 w-4 mr-2" />
                  Verify
                </a>
              </Button>
            </div>
          </div>

          {/* Document Info */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Document Information</CardTitle>
              <CardDescription>Metadata and provenance summary</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Workspace</p>
                <p className="font-medium">{document.workspace_name || 'Public'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Type</p>
                <p className="font-medium truncate">{document.mime_type}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">File Size</p>
                <p className="font-medium">{formatBytes(document.size_bytes)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Uploaded</p>
                <p className="font-medium">{formatDistanceToNow(document.created_at)} ago</p>
              </div>
              <div className="md:col-span-4">
                <p className="text-xs text-muted-foreground">SHA-256 Fingerprint</p>
                <div className="flex items-center gap-2 mt-1">
                  <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 break-all">{document.sha256}</code>
                  <Button variant="ghost" size="icon" onClick={copyHash} className="h-6 w-6 flex-shrink-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Version History */}
          <Card className="glass">
            <CardHeader>
              <CardTitle>Version History</CardTitle>
              <CardDescription>All registered versions of this document</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No version history available
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SHA-256</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                        <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((version) => (
                        <tr key={version.id} className="border-b border-white/5 hover:bg-white/5 transition-colors" data-testid="version-row">
                          <td className="p-3 font-mono font-medium">
                            <Badge variant={version.version_number === document.current_version ? 'default' : 'secondary'}>
                              v{version.version_number}
                            </Badge>
                          </td>
                          <td className="p-3 font-mono text-xs truncate max-w-[200px]">{version.sha256}</td>
                          <td className="p-3 text-sm">{formatBytes(version.size_bytes)}</td>
                          <td className="p-3 text-sm text-muted-foreground">{formatDistanceToNow(version.created_at)} ago</td>
                          <td className="p-3 text-sm text-muted-foreground truncate max-w-[200px]">{version.change_summary || 'Initial upload'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  )
}