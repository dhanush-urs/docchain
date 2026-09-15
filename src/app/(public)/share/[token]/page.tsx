'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, GitBranch, ShieldCheck, Eye, Download, Clock, CheckCircle, AlertCircle, ExternalLink, MessageSquare, Share2 } from 'lucide-react'
import { Card, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { formatDistanceToNow, formatBytes } from '@/lib/utils'

interface TimelineEvent {
  id: string
  event_type: string
  actor?: {
    full_name: string | null
    email: string
  } | null
  created_at: string
  version_number: number | null
  block_index: number
  block_hash: string
}

interface GuestLinkData {
  id: string
  token: string
  workspace_id: string
  document_id: string | null
  permissions: string[]
  expires_at: string | null
  revoked: boolean
  access_count: number
  created_at: string
  workspace?: {
    id: string
    name: string
    description: string | null
  }
  document?: {
    id: string
    filename: string
    original_filename: string
    mime_type: string
    size_bytes: number
    sha256: string
    current_version: number
    status: string
    created_at: string
  }
  documents?: any[]
  timeline?: TimelineEvent[]
  blockchain?: any[]
}

export default function GuestSharePage({ params }: { params: { token: string } }) {
  const [data, setData] = useState<GuestLinkData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'timeline' | 'blockchain'>('overview')

  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const token = params.token

        // Fetch guest link
        const { data: link, error: linkError } = await supabase
          .from('guest_links')
          .select('*, workspace:workspaces(*)')
          .eq('token', token)
          .single()

        if (linkError || !link) {
          throw new Error('Invalid or expired share link')
        }

        if (link.revoked) {
          throw new Error('This share link has been revoked')
        }

        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          throw new Error('This share link has expired')
        }

        // Check permissions
        const permissions = link.permissions || ['timeline', 'documents', 'versions', 'comments', 'blockchain']

        // Fetch documents if permitted
        let documents: any[] = []
        if (permissions.includes('documents')) {
          if (link.document_id) {
            const { data: doc } = await supabase
              .from('documents')
              .select('*')
              .eq('id', link.document_id)
              .eq('workspace_id', link.workspace_id)
              .single()
            if (doc) documents = [doc]
          } else {
            const { data: docs } = await supabase
              .from('documents')
              .select('*')
              .eq('workspace_id', link.workspace_id)
              .eq('status', 'active')
              .eq('visibility', 'public')
            documents = docs || []
          }
        }

        // Fetch timeline if permitted
        let timeline: any[] = []
        if (permissions.includes('timeline')) {
          const { data: events } = await supabase
            .from('timeline_events')
            .select(`
              *,
              actor:profiles(full_name, email),
              document_version:document_versions(version_number),
              block:blockchain_blocks(block_index, block_hash)
            `)
            .eq('workspace_id', link.workspace_id)
            .order('created_at', { ascending: false })
            .limit(50)
          timeline = events || []
        }

        // Fetch blockchain if permitted
        let blockchain: any[] = []
        if (permissions.includes('blockchain')) {
          const { data: blocks } = await supabase
            .from('blockchain_blocks')
            .select(`
              *,
              transaction:blockchain_transactions(
                *,
                actor:profiles(full_name, email)
              )
            `)
            .eq('workspace_id', link.workspace_id)
            .order('block_index', { ascending: false })
            .limit(50)
          blockchain = blocks || []
        }

        // Increment access count
        await supabase
          .from('guest_links')
          .update({ access_count: link.access_count + 1 })
          .eq('id', link.id)

        setData({
          ...link,
          workspace: link.workspace,
          document: documents[0],
          documents,
          timeline,
          blockchain,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load shared content')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [params.token])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading shared content...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="glass max-w-md w-full mx-auto">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2">Unable to Access</h3>
            <p className="text-muted-foreground mb-6">{error || 'This share link is invalid or has expired.'}</p>
            <a href="/" className="text-primary hover:underline">
              Return to DocChain
            </a>
          </CardContent>
        </Card>
      </div>
    )
  }

  const permissions = data.permissions || ['timeline', 'documents', 'versions', 'comments', 'blockchain']
  const isExpired = data.expires_at && new Date(data.expires_at) < new Date()

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-background/80 backdrop-blur-sm sticky top-0 z-50" data-testid="share-header">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <a href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
            <svg className="h-6 w-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <span>DocChain</span>
          </a>

          <div className="flex items-center gap-4">
            <span className="px-2 py-1 text-xs font-medium rounded-full bg-primary/20 text-primary">
              Guest Access
            </span>
            {isExpired && (
              <Badge variant="destructive" className="text-xs">Expired</Badge>
            )}
            {data.revoked && (
              <Badge variant="destructive" className="text-xs">Revoked</Badge>
            )}
            <a href="/login">
              <button className="btn btn-primary text-sm gap-2">
                <ExternalLink className="h-4 w-4" />
                Login
              </button>
            </a>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
              <ShieldCheck className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold mb-2">{data.workspace?.name || 'Shared Workspace'}</h1>
            <p className="text-muted-foreground">{data.workspace?.description || 'Shared provenance data'}</p>
            
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {data.permissions?.map((p: string) => (
                <Badge key={p} variant="secondary" className="text-xs">
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Badge>
              ))}
            </div>
            
            {data.expires_at && (
              <p className="mt-2 text-sm text-muted-foreground">
                Expires: {new Date(data.expires_at).toLocaleString()}
              </p>
            )}
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="glass w-fit mx-auto">
              {permissions.includes('documents') && (
                <TabsTrigger value="documents">Documents</TabsTrigger>
              )}
              {permissions.includes('timeline') && (
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
              )}
              {permissions.includes('blockchain') && (
                <TabsTrigger value="blockchain">Blockchain</TabsTrigger>
              )}
            </TabsList>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-6">
              {data.documents && data.documents.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {data.documents.map((doc: any) => (
                    <Card key={doc.id} className="glass hover:border-primary/50 transition-colors" data-testid="document-card">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <FileText className="h-10 w-10 text-primary" />
                          <Badge variant={doc.verified ? 'default' : 'secondary'}>
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
                          <span>{formatDistanceToNow(doc.created_at)} ago</span>
                          <span>v{doc.current_version}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No documents available in this share</p>
                </div>
              )}
            </TabsContent>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="mt-6">
              {data.timeline && data.timeline.length > 0 ? (
                <div className="space-y-4">
                  {data.timeline.map((event: any, index: number) => {
                    const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
                      document_uploaded: FileText,
                      document_version_created: GitBranch,
                      document_viewed: Eye,
                      document_downloaded: Download,
                      document_reviewed: MessageSquare,
                      comment_added: MessageSquare,
                      document_verified: CheckCircle,
                      document_shared: Share2,
                      guest_link_created: Share2,
                      guest_link_revoked: Share2,
                      document_archived: Clock,
                    }

                    const EVENT_LABELS: Record<string, string> = {
                      document_uploaded: 'Document Uploaded',
                      document_version_created: 'Version Created',
                      document_viewed: 'Document Viewed',
                      document_downloaded: 'Document Downloaded',
                      document_reviewed: 'Reviewed',
                      comment_added: 'Comment Added',
                      document_verified: 'Verified',
                      document_shared: 'Shared',
                      guest_link_created: 'Guest Link Created',
                      guest_link_revoked: 'Guest Link Revoked',
                      document_archived: 'Archived',
                    }

                    const Icon = EVENT_ICONS[event.event_type] || FileText
                    const label = EVENT_LABELS[event.event_type] || event.event_type

                    return (
                      <div key={event.id} className="relative flex gap-4">
                        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" style={{ top: index === 0 ? '1.5rem' : 0 }} />
                        <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                          <div className="w-3 h-3 rounded-full bg-primary/50 ring-2 ring-primary ring-offset-2 ring-offset-background" />
                        </div>
                        <div className="flex-1 min-w-0 py-2">
                          <Card className="glass hover:border-primary/30 transition-colors">
                            <CardContent className="p-4">
                              <div className="flex items-center gap-3 mb-2">
                                <Icon className="h-5 w-5 text-primary" />
                                <span className="font-medium text-foreground">{label}</span>
                                {event.version_number && (
                                  <Badge variant="secondary" className="text-xs">v{event.version_number}</Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  {event.actor?.full_name && (
                                    <>
                                      <span className="font-medium text-foreground">{event.actor.full_name}</span>
                                      <span>·</span>
                                    </>
                                  )}
                                  {formatDistanceToNow(event.created_at)} ago
                                </span>
                                <span className="flex items-center gap-1 font-mono">
                                  Block #{event.block_index}
                                </span>
                                <span className="font-mono text-muted-foreground/50">
                                  {event.block_hash}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No timeline events available in this share</p>
                </div>
              )}
            </TabsContent>

            {/* Blockchain Tab */}
            <TabsContent value="blockchain" className="mt-6">
              {data.blockchain && data.blockchain.length > 0 ? (
                <div className="space-y-4">
                  {data.blockchain.map((block: any) => (
                    <Card key={block.id} className="glass">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                              <ShieldCheck className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <h3 className="font-medium">Block #{block.block_index}</h3>
                              <p className="text-sm text-muted-foreground">
                                {block.transaction?.event_type ? block.transaction.event_type.replace(/_/g, ' ') : 'Transaction'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={block.block_hash.startsWith('0000') ? 'default' : 'destructive'}>
                            {block.block_hash.startsWith('0000') ? 'Valid' : 'Invalid'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Timestamp</p>
                            <p className="font-medium">{new Date(block.timestamp).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Nonce</p>
                            <p className="font-mono">{block.nonce}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Block Hash</p>
                            <p className="font-mono truncate max-w-full">{block.block_hash}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Previous Hash</p>
                            <p className="font-mono truncate max-w-full">{block.previous_hash}</p>
                          </div>
                        </div>
                        {block.transaction && (
                          <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Event Type</p>
                              <p className="font-medium capitalize">{block.transaction.event_type.replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Actor</p>
                              <p className="font-medium">{block.transaction.actor?.full_name || block.transaction.actor?.email || 'System'}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Transaction Hash</p>
                              <p className="font-mono truncate max-w-full">{block.transaction.transaction_hash}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Payload Hash</p>
                              <p className="font-mono truncate max-w-full">{block.payload_hash}</p>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No blockchain data available in this share</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-background/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>Shared via DocChain — Cryptographically Verifiable Document Provenance</p>
        </div>
      </footer>
    </div>
  )
}