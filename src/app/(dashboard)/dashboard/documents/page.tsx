'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Search, Plus, Download, Eye, Copy, MoreVertical, CheckCircle, AlertCircle, FileSpreadsheet, FileCode, FileImage, FileArchive, GitBranch, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { cn, formatBytes, formatDistanceToNow } from '@/lib/utils'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { DocumentViewer } from '@/components/documents/DocumentViewer'

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

function DocumentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  const Icon = MIME_ICONS[mimeType] || FileText
  return <Icon className={cn('flex-shrink-0', className)} />
}

function StatCard({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card className="glass">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardDocumentsPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadMode, setUploadMode] = useState<'file' | 'text'>('file')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [textContent, setTextContent] = useState('')
  const [textFilename, setTextFilename] = useState('')
  const [changeSummary, setChangeSummary] = useState('')
  const [targetDocumentId, setTargetDocumentId] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<string>('viewer')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [previewDoc, setPreviewDoc] = useState<any | null>(null)

  const fetchDocuments = useCallback(async () => {
    try {
      // Use API route to bypass infinite recursion RLS bug
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (statusFilter) params.append('status', statusFilter)

      const response = await fetch(`/api/documents?${params.toString()}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to load documents')
      }

      const { documents, userRole } = await response.json()
      setDocuments(documents || [])
      setUserRole(userRole || 'viewer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDocuments()
  }, [fetchDocuments])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleUpload = async () => {
    if (uploadMode === 'file' && !selectedFile) return
    if (uploadMode === 'text' && (!textContent.trim() || !textFilename.trim())) return

    setUploading(true)
    setUploadProgress(0)

    try {
      let fileToUpload: File
      if (uploadMode === 'text') {
        const blob = new Blob([textContent], { type: 'text/plain' })
        const finalFilename = textFilename.endsWith('.txt') ? textFilename : `${textFilename}.txt`
        fileToUpload = new File([blob], finalFilename, { type: 'text/plain' })
      } else {
        fileToUpload = selectedFile!
      }

      // 2. Validate filename
      if (!fileToUpload.name.trim()) throw new Error('Invalid filename')
      // 3. Validate MIME type
      if (!fileToUpload.type) throw new Error('Unknown file type')
      // 4. Validate file size
      if (fileToUpload.size === 0) throw new Error('File is empty')
      // 5. Maximum initial file size: 50MB
      if (fileToUpload.size > 50 * 1024 * 1024) throw new Error('File exceeds 50MB limit')

      // Calculate SHA-256
      const arrayBuffer = await fileToUpload.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Create FormData to send to our API
      const formData = new FormData()
      formData.append('file', fileToUpload)
      formData.append('clientSha256', sha256)
      if (changeSummary) {
        formData.append('changeSummary', changeSummary)
      }
      if (targetDocumentId) {
        formData.append('documentId', targetDocumentId)
      }

      // Upload via backend API which proxies to Edge Function
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      setShowUploadDialog(false)
      setSelectedFile(null)
      setTextContent('')
      setTextFilename('')
      setChangeSummary('')
      setTargetDocumentId(null)
      await fetchDocuments()

    } catch (err) {
      console.error('Upload error:', err)
      alert(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDownload = async (docId: string) => {
    try {
      const response = await fetch(`/api/documents/download?documentId=${docId}`)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Download failed')
      }

      const { signedUrl } = await response.json()
      
      // Create a temporary link to download the file directly
      const a = document.createElement('a')
      a.href = signedUrl
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (err) {
      console.error('Download error:', err)
      alert(err instanceof Error ? err.message : 'Download failed')
    }
  }

  const handleDelete = async (docId: string) => {
    if (!confirm('Archive this document? This will not delete provenance history.')) return

    try {
      const response = await fetch(`/api/documents?documentId=${docId}`, {
        method: 'DELETE'
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to archive document')
      }

      await fetchDocuments()
    } catch (err) {
      console.error('Delete error:', err)
      alert(err instanceof Error ? err.message : 'Failed to archive document')
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <Skeleton className="h-10 w-1/4" />
            <Skeleton className="h-10 w-1/2" />
          </div>
          <Skeleton className="h-64" />
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
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1">Manage your documents and provenance</p>
        </div>
        <Button className="gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setTargetDocumentId(null); setShowUploadDialog(true); }}>
          <Plus className="h-4 w-4" />
          Upload Document
        </Button>
        <Dialog open={showUploadDialog} onOpenChange={(open) => {
          setShowUploadDialog(open)
          if (!open) setTargetDocumentId(null)
        }}>
          <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{targetDocumentId ? 'Upload New Version' : 'Upload New Document'}</DialogTitle>
            <DialogDescription>
              {targetDocumentId ? 'Upload a new version of this document.' : 'Upload a new document to the provenance ledger.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Tabs value={uploadMode} onValueChange={(v: string) => setUploadMode(v as 'file' | 'text')} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="file">File Upload</TabsTrigger>
                <TabsTrigger value="text">Plain Text</TabsTrigger>
              </TabsList>
              
              <TabsContent value="file" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="file">File</Label>
                  <Input
                    type="file"
                    id="file"
                    onChange={(e) => e.target.files && e.target.files[0] && setSelectedFile(e.target.files[0])}
                    disabled={uploading}
                    required={uploadMode === 'file'}
                  />
                </div>
              </TabsContent>

              <TabsContent value="text" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="textFilename">Filename</Label>
                  <Input
                    id="textFilename"
                    value={textFilename}
                    onChange={(e) => setTextFilename(e.target.value)}
                    placeholder="e.g. notes.txt"
                    disabled={uploading}
                    required={uploadMode === 'text'}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textContent">Content</Label>
                  <Textarea
                    id="textContent"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Type or paste plain text here..."
                    className="min-h-[150px] font-mono text-sm"
                    disabled={uploading}
                    required={uploadMode === 'text'}
                  />
                </div>
              </TabsContent>
            </Tabs>
            
            <div className="space-y-2 pt-2">
              <Label htmlFor="changeSummary">Change Summary (optional)</Label>
              <Textarea
                id="changeSummary"
                value={changeSummary}
                onChange={(e) => setChangeSummary(e.target.value)}
                placeholder="Describe what changed in this version..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button disabled={uploading || (uploadMode === 'file' ? !selectedFile : (!textContent.trim() || !textFilename.trim()))} onClick={handleUpload}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </DialogFooter>
        </DialogContent>
        </Dialog>

        <Dialog open={!!previewDoc} onOpenChange={(open) => !open && setPreviewDoc(null)}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="sr-only">Preview Document</DialogTitle>
              <DialogDescription className="sr-only">Preview the selected document</DialogDescription>
            </DialogHeader>
            {previewDoc && (
              <DocumentViewer documentId={previewDoc.id} workspaceId={previewDoc.workspace_id} />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Documents" value={documents.filter(d => d.status === 'active').length} icon={FileText} />
        <StatCard label="Total Versions" value={documents.reduce((sum, d) => sum + d.current_version, 0)} icon={GitBranch} />
        <StatCard label="Verified" value={documents.filter(d => d.verified).length} icon={CheckCircle} />
        <StatCard label="Archived" value={documents.filter(d => d.status === 'archived').length} icon={AlertCircle} />
      </div>

      {/* Filters */}
      <Card className="glass mb-6">
        <CardContent className="pt-0">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Label htmlFor="search" className="sr-only">Search documents</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  type="search"
                  placeholder="Search documents..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

          </div>
        </CardContent>
      </Card>

      {/* Documents Table */}
      <Card className="glass">
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-16 w-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No documents found</h3>
              <p className="text-muted-foreground">
                {search
                  ? 'Try adjusting your search or filters'
                  : 'Upload your first document to get started'}
              </p>
              <Button className="mt-4 gap-2" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowUploadDialog(true); }}>
                <Plus className="h-4 w-4" />
                Upload Document
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Document</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Size</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Version</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">SHA-256</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left p-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Updated</th>
                      <th className="text-right p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => (
                      <tr key={doc.id} className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer" data-testid="document-card" onClick={() => setPreviewDoc(doc)}>
                        <td className="p-3">
                          <div className="flex items-center gap-3">
                            <DocumentIcon mimeType={doc.mime_type} className="h-8 w-8 text-primary" />
                            <div>
                              <p className="font-medium truncate max-w-xs">{doc.original_filename}</p>
                              <p className="text-xs text-muted-foreground">v{doc.current_version}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{doc.mime_type}</td>
                        <td className="p-3 text-sm">{formatBytes(doc.size_bytes)}</td>
                        <td className="p-3 font-mono text-sm">v{doc.current_version}</td>
                        <td className="p-3 font-mono text-xs truncate max-w-[200px]">{doc.sha256}</td>
                        <td className="p-3">
                          <Badge variant={doc.verified ? 'default' : doc.status === 'archived' ? 'secondary' : 'outline'}>
                            {doc.verified ? 'Verified' : doc.status === 'archived' ? 'Archived' : doc.status}
                          </Badge>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground">{formatDistanceToNow(doc.updated_at)} ago</td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon" className="h-8 w-8" />}>
                              <MoreVertical className="h-4 w-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPreviewDoc(doc)} className="cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                <span>Preview</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => window.open(`/documents/${doc.id}`, '_blank')} className="cursor-pointer">
                                <Eye className="h-4 w-4 mr-2" />
                                <span>View Provenance</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDownload(doc.id)} className="cursor-pointer">
                                <Download className="h-4 w-4 mr-2" />
                                <span>Download</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigator.clipboard.writeText(doc.sha256)} className="cursor-pointer">
                                <Copy className="h-4 w-4 mr-2" />
                                <span>Copy Hash</span>
                              </DropdownMenuItem>
                              {['admin', 'editor'].includes(userRole) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => { setTargetDocumentId(doc.id); setShowUploadDialog(true); }} className="cursor-pointer">
                                    <FileText className="h-4 w-4 mr-2" />
                                    <span>New Version</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                              {userRole === 'admin' && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem onClick={() => handleDelete(doc.id)} className="text-destructive focus:text-destructive cursor-pointer">
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    <span>Archive</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}