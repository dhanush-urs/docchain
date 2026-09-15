'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, Share2, AlertCircle, Copy, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { cn, formatDistanceToNow } from '@/lib/utils'

interface GuestLinkData {
  id: string
  token: string
  workspace_id: string
  document_id: string | null
  created_by: string
  permissions: string[]
  expires_at: string | null
  revoked: boolean
  access_count: number
  created_at: string
}

export default function DashboardSharingPage() {
  const [links, setLinks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [permissions, setPermissions] = useState<string[]>(['timeline', 'documents', 'versions', 'comments', 'blockchain'])
  const [expiresAt, setExpiresAt] = useState('')
  const [documentId, setDocumentId] = useState('')
  const [userRole, setUserRole] = useState<string>('viewer')

  const supabase = createClient()

  const fetchLinks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/guest')
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error || 'Failed to load guest links')
      }
      const data = await res.json()
      setLinks(data.links || [])
      setUserRole(data.role || 'viewer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load guest links')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLinks()
  }, [fetchLinks])

  const handleCreateLink = async () => {
    if (!documentId) {
      alert('Please select a document')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/guest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId, permissions, expiresAt: expiresAt || null })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create guest link')

      const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'
      const shareUrl = `${baseUrl}/share/${data.token}`

      setShowCreateDialog(false)
      setPermissions(['timeline', 'documents', 'versions', 'comments', 'blockchain'])
      setExpiresAt('')
      setDocumentId('')
      await fetchLinks()

      // Show share URL
      alert(`Guest link created! Share URL: ${shareUrl}`)
    } catch (err) {
      console.error('Guest link error:', err)
      alert(err instanceof Error ? err.message : 'Internal server error')
    } finally {
      setLoading(false)
    }
  }

  const handleRevokeLink = async (linkId: string) => {
    try {
      const res = await fetch(`/api/guest?linkId=${linkId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to revoke link')
      
      await fetchLinks()
    } catch (err) {
      console.error('Guest link revoke error:', err)
      alert(err instanceof Error ? err.message : 'Failed to revoke link')
    }
  }

  const handleRevoke = (linkId: string) => {
    if (confirm('Revoke this guest link? This action cannot be undone.')) {
      handleRevokeLink(linkId)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sharing</h1>
          <p className="text-muted-foreground mt-1">Manage secure guest access to your documents</p>
        </div>
        {['admin', 'editor'].includes(userRole) && (
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Share2 className="h-4 w-4" />
            Create Guest Link
          </Button>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="glass rounded-lg p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card className="glass">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Failed to load guest links</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchLinks}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : links.length === 0 ? (
        <Card className="glass">
          <CardContent className="pt-6 text-center py-12">
            <Share2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No guest links yet</h3>
            <p className="text-muted-foreground mb-6">Create a secure share link to share documents with external parties</p>
            {['admin', 'editor'].includes(userRole) && (
              <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
                <Share2 className="h-4 w-4" />
                Create Guest Link
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {links.map((link) => (
            <Card key={link.id} className="glass hover:border-primary/30 transition-colors" data-testid="guest-link">
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Share2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">Guest Link</h3>
                      <p className="text-sm text-muted-foreground">{link.document_id ? 'Document specific' : 'Workspace wide'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={link.revoked ? 'destructive' : link.expires_at && new Date(link.expires_at) < new Date() ? 'destructive' : 'default'}>
                      {link.revoked ? 'Revoked' : link.expires_at && new Date(link.expires_at) < new Date() ? 'Expired' : 'Active'}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">Access: {link.access_count}</Badge>
                    {link.expires_at && (
                      <Badge variant="secondary" className="text-xs">
                        Expires: {new Date(link.expires_at).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-sm">
                  <Badge variant="outline" className="gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    Permissions: {link.permissions?.join(', ') || 'All'}
                  </Badge>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => {
                    const baseUrl = window.location.origin
                    const shareUrl = `${baseUrl}/share/${link.token}`
                    navigator.clipboard.writeText(shareUrl)
                    alert('Share URL copied to clipboard!')
                  }} className="gap-1">
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </Button>
                  {['admin', 'editor'].includes(userRole) && (
                    <Button variant="outline" size="sm" onClick={() => handleRevoke(link.id)} disabled={link.revoked} data-testid="revoke-link">
                      <AlertCircle className="h-4 w-4" />
                      Revoke
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Guest Link Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogTrigger>
          <Button className="gap-2">
            <Share2 className="h-4 w-4" />
            Create Guest Link
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Guest Link</DialogTitle>
            <DialogDescription>Generate a secure read-only share link for documents or workspace</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="document">Document (optional - leave empty for workspace-wide access)</Label>
              <Select value={documentId} onValueChange={(v) => setDocumentId(v ?? '')}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a document (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Workspace wide</SelectItem>
                  {/* Would fetch documents here */}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {['timeline', 'documents', 'versions', 'comments', 'blockchain'].map((perm) => (
                  <label key={perm} className="flex items-center gap-2">
                    <Checkbox
                      checked={permissions.includes(perm)}
                      onCheckedChange={(checked: boolean | 'indeterminate') => {
                        if (checked === true) {
                          setPermissions([...permissions, perm])
                        } else {
                          setPermissions(permissions.filter(p => p !== perm))
                        }
                      }}
                    />
                    <span className="capitalize">{perm}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiresAt">Expiration (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleCreateLink} disabled={loading}>
              {loading ? 'Creating...' : 'Create Guest Link'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}