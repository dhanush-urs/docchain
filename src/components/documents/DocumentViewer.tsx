'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Download, Eye, Copy, CheckCircle, AlertCircle, Clock, FileImage, FileSpreadsheet, FileCode, FileArchive } from 'lucide-react'
import { cn, formatBytes, formatDistanceToNow, truncate, getFileIcon } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

interface DocumentViewerProps {
  documentId: string
  workspaceId: string
  version?: number
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

export function DocumentViewer({ documentId, workspaceId, version }: DocumentViewerProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [document, setDocument] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [versions, setVersions] = useState<any[]>([])
  const [currentVersion, setCurrentVersion] = useState<number | null>(version || null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [textContent, setTextContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pdfRef = useRef<HTMLDivElement>(null)

  const supabase = createClient()

  const fetchDocumentAndVersions = async () => {
    try {
      const res = await fetch(`/api/documents?workspaceId=${workspaceId}&documentId=${documentId}`)
      if (!res.ok) throw new Error('Failed to load document')
      
      const { document: docData, versions: versionsData } = await res.json()
      setDocument(docData)
      setVersions(versionsData || [])
      if (!currentVersion) setCurrentVersion(docData.current_version)
    } catch (err) {
      setError('Failed to load document')
    } finally {
      setLoading(false)
    }
  }

  const fetchUrls = async (ver: number) => {
    try {
      setTimeout(() => setPreviewLoading(true), 0)
      
      const versionData = versions.find(v => v.version_number === ver) || versions[0]
      if (!versionData) return

      if (versionData.preview_url) {
        setPreviewUrl(versionData.preview_url)
      } else {
        setPreviewUrl(null)
      }

      if (versionData.download_url) {
        setDownloadUrl(versionData.download_url)
      }
    } catch (err) {
      console.error('Failed to fetch URLs:', err)
    } finally {
      setTimeout(() => setPreviewLoading(false), 50)
    }
  }

  const handleVersionChange = async (ver: number) => {
    setCurrentVersion(ver)
    await fetchUrls(ver)
  }

  const copyHash = () => {
    navigator.clipboard.writeText(document?.sha256 || '')
  }

  const handleDownload = () => {
    if (downloadUrl) {
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = document?.original_filename || document?.filename
      a.click()
    }
  }

  const verifyDocument = async () => {
    if (!document) return
    // Navigate to verify page with current document
    window.open(`/verify?doc=${document.id}&ver=${currentVersion}`, '_blank')
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocumentAndVersions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, workspaceId])

  useEffect(() => {
    if (currentVersion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchUrls(currentVersion)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentVersion, versions])

  useEffect(() => {
    if (previewUrl && document) {
      const mime = document.mime_type
      if (['text/plain', 'text/markdown', 'text/csv', 'application/json'].includes(mime)) {
        fetch(previewUrl)
          .then(res => res.text())
          .then(text => setTextContent(text))
          .catch(console.error)
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setTextContent(null)
      }
    }
  }, [previewUrl, document])

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/4" />
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-[500px]" />
      </div>
    )
  }

  if (error || !document) {
    return (
      <Card className="glass">
        <CardContent className="py-12 text-center">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Document not found</h3>
          <p className="text-muted-foreground">{error || 'Unable to load document'}</p>
        </CardContent>
      </Card>
    )
  }

  const Icon = MIME_ICONS[document.mime_type] || FileText
  const isVerified = document.status === 'active' && document.current_version > 0

  return (
    <div className="space-y-6">
      {/* Document Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={cn(
            'w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0',
            document.mime_type.startsWith('image/') ? 'bg-green-500/10' :
            document.mime_type === 'application/pdf' ? 'bg-red-500/10' :
            document.mime_type.includes('spreadsheet') ? 'bg-green-500/10' :
            document.mime_type.includes('json') || document.mime_type.includes('xml') ? 'bg-yellow-500/10' : 'bg-blue-500/10'
          )}>
            <Icon className={cn(
              'h-8 w-8',
              document.mime_type.startsWith('image/') ? 'text-green-500' :
              document.mime_type === 'application/pdf' ? 'text-red-500' :
              document.mime_type.includes('spreadsheet') ? 'text-green-500' :
              document.mime_type.includes('json') || document.mime_type.includes('xml') ? 'text-yellow-500' : 'text-blue-500'
            )} />
          </div>
          <div>
            <h1 className="text-2xl font-bold truncate max-w-md">{document.original_filename}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <Badge variant={isVerified ? 'default' : 'secondary'}>
                {isVerified ? (
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
              <span>v{currentVersion || document.current_version}</span>
              <span>{formatBytes(document.size_bytes)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={handleDownload} disabled={!downloadUrl || previewLoading}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="outline" onClick={copyHash}>
            <Copy className="h-4 w-4 mr-2" />
            Copy Hash
          </Button>
          <Button variant="outline" onClick={verifyDocument}>
            <Eye className="h-4 w-4 mr-2" />
            Verify
          </Button>
          <Button variant="outline" onClick={() => window.open(`/dashboard/documents/${document.id}`, '_blank')}>
            <Eye className="h-4 w-4 mr-2" />
            Full Provenance
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
            <p className="font-medium">{document.workspace?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">File Type</p>
            <p className="font-medium text-capitalize">{document.mime_type}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">File Size</p>
            <p className="font-medium">{formatBytes(document.size_bytes)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Uploaded</p>
            <p className="font-medium">{formatDistanceToNow(document.created_at)} ago</p>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">SHA-256</p>
            <div className="flex items-center gap-2">
              <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{document.sha256}</code>
              <Button variant="ghost" size="icon" onClick={copyHash} className="h-6 w-6">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <p className="text-xs text-muted-foreground">Uploaded By</p>
            <p className="font-medium">{document.uploaded_by}</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview / Content */}
      <Card className="glass">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Preview</CardTitle>
            <div className="flex items-center gap-2">
              {versions.length > 1 && (
                <select
                  value={currentVersion || document.current_version}
                  onChange={(e) => handleVersionChange(parseInt(e.target.value))}
                  className="px-3 py-1 text-sm border border-white/10 rounded-lg bg-background"
                >
                  {versions.map(v => (
                    <option key={v.id} value={v.version_number}>
                      v{v.version_number} - {formatDistanceToNow(v.created_at)} ago
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {previewLoading ? (
            <div className="h-[500px] flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : previewUrl ? (
            <div className="relative h-[500px] rounded-lg overflow-hidden bg-muted">
              {document.mime_type === 'application/pdf' ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-full border-0"
                  title={document.original_filename}
                />
              ) : document.mime_type.startsWith('application/vnd') || document.mime_type === 'application/msword' ? (
                <iframe
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`}
                  className="w-full h-full border-0"
                  title={document.original_filename}
                />
              ) : document.mime_type.startsWith('image/') ? (
                <img
                  src={previewUrl}
                  alt={document.original_filename}
                  className="w-full h-full object-contain"
                />
              ) : textContent !== null ? (
                <ScrollArea className="h-full w-full bg-background p-4 border rounded-lg">
                  <pre className="text-sm font-mono whitespace-pre-wrap">{textContent}</pre>
                </ScrollArea>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <p>Preview not available for this file type</p>
                    <Button variant="outline" className="mt-4" onClick={handleDownload}>
                      <Download className="h-4 w-4 mr-2" />
                      Download to view
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-[500px] flex items-center justify-center text-muted-foreground">
              <p>No preview available</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      {versions.length > 0 && (
        <Card className="glass">
          <CardHeader>
            <CardTitle>Version History</CardTitle>
            <CardDescription>{versions.length} version(s) - click to view</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="max-h-64">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SHA-256</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploaded</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Uploader</th>
                    <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Summary</th>
                    <th className="text-right p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {versions.map((v) => (
                    <tr key={v.id} className={cn(
                      'border-b border-white/5 transition-colors',
                      currentVersion === v.version_number && 'bg-primary/5'
                    )}>
                      <td className="p-3 font-mono font-medium">
                        <Badge variant={currentVersion === v.version_number ? 'default' : 'outline'}>
                          v{v.version_number}
                        </Badge>
                      </td>
                      <td className="p-3 font-mono text-xs truncate max-w-[200px]">{v.sha256}</td>
                      <td className="p-3 text-sm">{formatBytes(v.size_bytes)}</td>
                      <td className="p-3 text-sm text-muted-foreground">{formatDistanceToNow(v.created_at)} ago</td>
                      <td className="p-3 text-sm">{v.uploaded_by}</td>
                      <td className="p-3 text-sm text-muted-foreground truncate max-w-[200px]">{v.change_summary || '—'}</td>
                      <td className="p-3 text-right">
                        {currentVersion !== v.version_number && (
                          <Button variant="ghost" size="icon" onClick={() => handleVersionChange(v.version_number)} className="h-6 w-6">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}