'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { FileText, GitBranch, ShieldCheck, Search, Share2, Plus, ArrowRight, CheckCircle, Clock, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { DocumentViewer } from '@/components/documents/DocumentViewer'
import { cn, formatDistanceToNow } from '@/lib/utils'

interface StatItem {
  label: string
  value: string
  icon: React.ComponentType<{ className?: string }>
  change: string
  trend: 'up' | 'neutral'
}

interface ActivityItem {
  type: string
  actor: string
  document: string
  documentId?: string
  workspaceId?: string
  version: number
  time: string
  block: number
}

const initialStats: StatItem[] = [
  { label: 'Documents', value: '—', icon: FileText, change: '+0 this week', trend: 'up' },
  { label: 'Versions', value: '—', icon: GitBranch, change: '+0 this week', trend: 'up' },
  { label: 'Blocks', value: '—', icon: ShieldCheck, change: '+0 this week', trend: 'up' },
  { label: 'Verified', value: '—', icon: CheckCircle, change: '+0 this week', trend: 'up' },
  { label: 'Pending Reviews', value: '—', icon: Clock, change: '0 new', trend: 'neutral' },
]

export default function DashboardPage() {
  const [stats, setStats] = useState<StatItem[]>(initialStats)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)
  const [previewDoc, setPreviewDoc] = useState<{id: string, workspace_id: string} | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/dashboard')
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard data')
        }

        const data = await response.json()
        const { stats: fetchedStats, recentActivity: events } = data

        setStats([
          { label: 'Documents', value: fetchedStats.docCount.toString(), icon: FileText, change: '+0 this week', trend: 'up' },
          { label: 'Versions', value: fetchedStats.totalVersions.toString(), icon: GitBranch, change: '+0 this week', trend: 'up' },
          { label: 'Blocks', value: fetchedStats.blockCount.toString(), icon: ShieldCheck, change: '+0 this week', trend: 'up' },
          { label: 'Verified', value: fetchedStats.verifiedCount.toString(), icon: CheckCircle, change: '+0 this week', trend: 'up' },
          { label: 'Pending Reviews', value: '0', icon: Clock, change: '0 new', trend: 'neutral' },
        ])

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setRecentActivity((events || []).map((event: any) => ({
          type: event.event_type,
          actor: event.actor?.full_name || event.actor?.email || 'Unknown',
          document: event.document?.original_filename || 'Unknown',
          documentId: event.document_id,
          workspaceId: event.workspace_id,
          version: event.document_version?.version_number || 1,
          time: formatDistanceToNow(event.created_at),
          block: event.block?.block_index || 0,
        })))

      } catch (err) {
        console.error('Failed to fetch stats:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Overview of your document provenance activity</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/documents">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Upload Document
            </Button>
          </Link>

        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="glass">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.label}</CardTitle>
              <div className={cn(
                'p-2 rounded-lg',
                stat.trend === 'up' ? 'bg-green-500/10' : 'bg-gray-500/10'
              )}>
                <stat.icon className={cn(
                  'h-5 w-5',
                  stat.trend === 'up' ? 'text-green-500' : 'text-muted-foreground'
                )} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="gap-8">
        <Card className="glass">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Provenance Activity</CardTitle>
            <Link href="/dashboard/documents" className="text-sm text-primary hover:underline flex items-center gap-1">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activity
                </div>
              ) : (
                recentActivity.map((activity, index) => {
                  const Icon = activity.type === 'document_uploaded' ? FileText :
                    activity.type === 'document_version_created' ? GitBranch :
                    activity.type === 'document_reviewed' ? Search :
                    activity.type === 'document_verified' ? CheckCircle :
                    activity.type === 'guest_link_created' ? Share2 :
                    FileText
                  return (
                    <div 
                      key={activity.type + index} 
                      className={cn("flex gap-4 p-3 glass rounded-lg transition-colors", activity.documentId && activity.workspaceId ? "cursor-pointer hover:border-primary/50" : "hover:border-primary/30")}
                      onClick={() => {
                        if (activity.documentId && activity.workspaceId) {
                          setPreviewDoc({ id: activity.documentId, workspace_id: activity.workspaceId })
                        }
                      }}
                    >
                      <div className="relative flex-shrink-0 w-10 h-10 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-primary/50" />
                        {index < recentActivity.length - 1 && (
                          <div className="absolute left-4 top-10 bottom-0 w-0.5 bg-white/10" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Icon className="h-4 w-4 text-primary" />
                          <span className="font-medium text-sm">{activity.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
                          <Badge variant="secondary" className="text-xs">Block #{activity.block}</Badge>
                        </div>
                        <p className="text-sm text-foreground mb-1 hover:underline">{activity.document}</p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <span className="font-medium text-foreground">{activity.actor}</span>
                            <span>·</span>
                            {activity.time} ago
                          </span>
                          <span>v{activity.version}</span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>


      </div>
      
      {/* Preview Dialog */}
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
  )
}