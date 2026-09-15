'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Eye, Download, MessageSquare, CheckCircle, Share2, Clock, GitBranch } from 'lucide-react'
import { formatDistanceToNow } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

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

export function PublicTimeline({ limit = 10 }: { limit?: number }) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEvents = useCallback(async () => {
    try {
      const supabase = createClient()
      
      const { data, error } = await supabase
        .from('timeline_events')
        .select(`
          *,
          actor:profiles(full_name, email),
          document_version:document_versions(version_number),
          block:blockchain_blocks(block_index, block_hash)
        `)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) throw error

      const formattedEvents: TimelineEvent[] = (data || []).map((event) => ({
        id: event.id,
        event_type: event.event_type,
        actor_name: event.actor?.full_name || event.actor?.email || null,
        timestamp: event.created_at,
        version_number: event.document_version?.version_number || null,
        block_index: event.block?.block_index || 0,
        block_hash: event.block?.block_hash || '',
      }))

      setEvents(formattedEvents)
    } catch (err) {
      console.error('Failed to load timeline events', err)
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchEvents()
  }, [fetchEvents])

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No public events yet
        </div>
      ) : (
        events.map((event, index) => {
          const Icon = EVENT_ICONS[event.event_type] || FileText
          const label = EVENT_LABELS[event.event_type] || event.event_type

          return (
            <div key={event.id} className="relative flex gap-4" data-testid="timeline-node">
              {/* Vertical line */}
              <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-white/10" style={{ top: index === 0 ? '1.5rem' : 0 }} />

              {/* Timeline dot */}
              <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-primary/50 ring-2 ring-primary ring-offset-2 ring-offset-background" />
              </div>

              {/* Event content */}
              <div className="flex-1 min-w-0 py-2">
                <div className="glass rounded-lg p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-medium text-foreground">{label}</span>
                    {event.version_number && (
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-primary/20 text-primary">
                        v{event.version_number}
                      </span>
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
                    <span className="font-mono text-muted-foreground/50 truncate max-w-[150px]">
                      {event.block_hash}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}

      {events.length >= limit && (
        <div className="relative flex gap-4">
          <div className="absolute left-5 top-0 h-full w-0.5 border-t border-dashed border-white/10" />
        </div>
      )}
    </div>
  )
}