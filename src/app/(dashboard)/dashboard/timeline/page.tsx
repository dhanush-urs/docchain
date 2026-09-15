'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FileText, GitBranch, ShieldCheck, Eye, Download, MessageSquare, CheckCircle, Share2, Clock, AlertCircle, Search, Plus } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatDistanceToNow } from '@/lib/utils'

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

export default function DashboardTimelinePage() {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const LIMIT = 20

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .single()

      if (!member) return

      const { data: events, error, count } = await supabase
        .from('timeline_events')
        .select(`
          *,
          actor:profiles(full_name, email),
          document_version:document_versions(version_number),
          block:blockchain_blocks(block_index, block_hash),
          document:documents(filename, original_filename)
        `)
        .eq('workspace_id', member.workspace_id)
        .order('created_at', { ascending: false })
        .range((page - 1) * LIMIT, page * LIMIT - 1)

      if (error) throw error

      const formattedEvents = (events || []).map((event) => ({
        id: event.id,
        event_type: event.event_type,
        actor_name: event.actor?.full_name || event.actor?.email || null,
        timestamp: event.created_at,
        version_number: event.document_version?.version_number || null,
        block_index: event.block?.block_index || 0,
        block_hash: event.block?.block_hash || '',
      }))

      setEvents(formattedEvents)
      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / LIMIT))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold">Provenance Timeline</h1>
          <p className="text-muted-foreground mt-1">Complete history of document events and provenance</p>
        </div>
        <Link href="/verify">
          <Button variant="outline" className="gap-2">
            <Search className="h-4 w-4" />
            Verify Document
          </Button>
        </Link>
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
            <h3 className="text-lg font-medium mb-2">Failed to load timeline</h3>
            <p className="text-muted-foreground mb-4">{error}</p>
            <Button variant="outline" onClick={fetchEvents}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.length === 0 ? (
            <Card className="glass">
              <CardContent className="pt-6 text-center py-12">
                <GitBranch className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No timeline events yet</h3>
                <p className="text-muted-foreground mb-6">Upload your first document to start building the provenance timeline</p>
                <a href="/dashboard/documents">
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Upload Document
                  </Button>
                </a>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {events.map((event, index) => {
                const Icon = EVENT_ICONS[event.event_type] || FileText

                return (
                  <div key={event.id} className="relative flex gap-4" data-testid="timeline-node">
                    <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" style={{ top: index === 0 ? '1.5rem' : 0 }} />

                    <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                      <div className="w-3 h-3 rounded-full bg-primary/50 ring-2 ring-primary ring-offset-2 ring-offset-background" />
                    </div>

                    <div className="flex-1 min-w-0 py-2">
                      <Card className="glass hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex items-center gap-3 mb-2">
                            <Icon className="h-5 w-5 text-primary" />
                            <span className="font-medium text-foreground">{EVENT_LABELS[event.event_type] || event.event_type}</span>
                            {event.version_number && (
                              <Badge variant="secondary" className="text-xs">v{event.version_number}</Badge>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {event.actor_name && (
                                <>
                                  <span className="font-medium text-foreground">{event.actor_name}</span>
                                  <span>·</span>
                                </>
                              )}
                              {formatDistanceToNow(event.timestamp)} ago
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

              {events.length < totalCount && (
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
            </div>
          )}
        </div>
      )}
    </div>
  )
}