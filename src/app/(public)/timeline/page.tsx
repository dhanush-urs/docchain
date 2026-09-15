'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, GitBranch, Eye, Download, MessageSquare, CheckCircle, Share2, Clock, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, formatDistanceToNow } from '@/lib/utils'
import { Footer } from '@/components/layout/Footer'

interface TimelineEvent {
  id: string
  event_type: string
  actor_name: string | null
  timestamp: string
  version_number: number | null
  block_index: number
  block_hash: string
}

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

export default function PublicTimelinePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const LIMIT = 20

  const supabase = createClient()

  const fetchEvents = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('timeline_events')
        .select(`
          *,
          actor:profiles(full_name),
          document_version:document_versions(version_number),
          block:blockchain_blocks(block_index, block_hash),
          document:documents(filename, original_filename, workspace:workspaces(name, visibility))
        `)
        .eq('document.visibility', 'public')
        .eq('document.workspace_id', 'workspaces.id')
        .eq('workspaces.visibility', 'public')
        .order('created_at', { ascending: false })
        .range((page - 1) * LIMIT, page * LIMIT - 1)

      const { data, error, count } = await query

      if (error) throw error

      const formattedEvents = (data || []).map((event) => ({
        id: event.id,
        event_type: event.event_type,
        actor_name: event.actor?.full_name || null,
        timestamp: event.created_at,
        version_number: event.document_version?.version_number || null,
        block_index: event.block?.block_index || 0,
        block_hash: event.block?.block_hash || '',
      }))

      setEvents(formattedEvents)
      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / LIMIT))
    } catch (err) {
      setError((err as any)?.message || 'Failed to load timeline')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center mb-12">
              <h1 className="text-3xl md:text-4xl font-bold mb-4">Provenance Timeline</h1>
              <p className="text-muted-foreground">Recent provenance events from public documents</p>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
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
          </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl md:text-4xl font-bold mb-4">Provenance Timeline</h1>
            <p className="text-muted-foreground">Recent provenance events from public documents</p>
          </div>

          <div className="space-y-4">
            {events.map((event, index) => {
              const Icon = EVENT_ICONS[event.event_type] || FileText
              const label = EVENT_LABELS[event.event_type] || event.event_type

              return (
                <div key={event.id} className="relative flex gap-4">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" style={{ top: index === 0 ? '1.5rem' : 0 }} />

                  {/* Timeline dot */}
                  <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    <div className="w-3 h-3 rounded-full bg-primary/50 ring-2 ring-primary ring-offset-2 ring-offset-background" />
                  </div>

                  {/* Event content */}
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
          </div>

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
    </div>
  )
}
