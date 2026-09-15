import React, { useState, useEffect } from 'react'
import { ReactFlow, Background, Controls } from 'reactflow'
import { FileText, GitBranch, ShieldCheck, Eye, Download, MessageSquare, CheckCircle, Share2, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import 'reactflow/dist/style.css'

interface TimelineNodeData {
  block: {
    id: string
    block_index: number
    block_hash: string
    previous_hash: string
    timestamp: string
    nonce: number
    transaction_hash: string
    payload_hash: string
  }
  transaction: {
    id: string
    event_type: string
    actor_id: string
    payload: Record<string, unknown>
  }
  actor: {
    full_name: string | null
    email: string
  } | null
  document?: {
    filename: string
    original_filename: string
  }
}

interface TimelineVisualizationProps {
  nodes: TimelineNodeData[]
  onNodeClick?: (node: any) => void
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

const EVENT_COLORS: Record<string, string> = {
  document_uploaded: 'bg-blue-500',
  document_version_created: 'bg-purple-500',
  document_viewed: 'bg-gray-500',
  document_downloaded: 'bg-indigo-500',
  document_reviewed: 'bg-orange-500',
  comment_added: 'bg-teal-500',
  document_verified: 'bg-green-500',
  document_shared: 'bg-blue-500',
  guest_link_created: 'bg-blue-500',
  guest_link_revoked: 'bg-red-500',
  document_archived: 'bg-yellow-500',
}

function TimelineNode({ data }: { data: TimelineNodeData }) {
  const { block, transaction, actor, document } = data
  const Icon = EVENT_ICONS[transaction.event_type] || FileText
  const label = EVENT_LABELS[transaction.event_type] || transaction.event_type
  const color = EVENT_COLORS[transaction.event_type] || 'bg-gray-500'

  return (
    <div className={cn(
      'group relative w-80 min-h-[120px] glass rounded-xl p-4 border border-white/10 transition-all duration-200',
      'hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10'
    )}>
      <div className="absolute -top-2 -right-2 px-2 py-0.5 text-xs font-mono bg-primary/20 text-primary rounded-full">
        #{block.block_index}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', color)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-foreground truncate">{EVENT_LABELS[transaction.event_type] || transaction.event_type}</p>
          <p className="text-xs text-muted-foreground">{document ? `v${transaction.payload.version || 1}` : 'Workspace'}</p>
        </div>
      </div>

      {document && (
        <div className="mb-3 p-2 glass rounded-lg border border-white/5">
          <p className="text-xs font-medium truncate">{document.original_filename}</p>
          <p className="text-xs text-muted-foreground font-mono">{block.block_hash.slice(0, 16)}...</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        {actor && (
          <span className="flex items-center gap-1">
            <span className="font-medium text-foreground">{actor.full_name || actor.email}</span>
          </span>
        )}
        <span>{new Date(block.timestamp).toLocaleString()}</span>
        <span className="font-mono">{block.block_hash.slice(0, 12)}...</span>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2">
        <div className="w-3 h-3 rounded-full bg-primary/50 border-2 border-background" />
      </div>
    </div>
  )
}

function TimelineEdge() {
  return (
    <path
      d={`M ${0} ${0} L ${0} ${80}`}
      stroke="white"
      strokeWidth={1}
      strokeDasharray="4,4"
      opacity={0.2}
      style={{ pointerEvents: 'none' }}
    />
  )
}

const markerEndObj = {
  type: 'arrowclosed' as const,
  color: 'white',
  width: 10,
  height: 10,
}

export function TimelineVisualization({ nodes: timelineData }: { nodes: any[] }) {
  const [nodes, setNodes] = React.useState<any[]>([])
  const [edges, setEdges] = React.useState<any[]>([])
  const [selectedNode, setSelectedNode] = React.useState<any>(null)

  React.useEffect(function() {
    const newNodes = timelineData.map(function(data, index) {
      return {
        id: data.block.id,
        type: 'custom',
        position: { x: 0, y: index * 200 },
        data: data,
        draggable: false,
      }
    })

    const newEdges = newNodes.slice(0, -1).map(function(node, index) {
      return {
        id: 'edge-' + node.id + '-' + (newNodes[index + 1]?.id || ''),
        source: node.id,
        target: newNodes[index + 1]?.id,
        type: 'smoothstep',
        animated: true,
        style: { stroke: 'white', strokeWidth: 1, strokeDasharray: '4,4', opacity: 0.2 },
        markerEnd: markerEndObj,
      }
    })

    setNodes(newNodes)
    setEdges(newEdges)
  }, [timelineData])

  const handleNodeClick = function(event: React.MouseEvent, node: any) {
    // setSelectedNode(node)
  }

  return React.createElement('div', { className: 'w-full h-[600px] glass rounded-xl overflow-hidden' }, [
    React.createElement('div', { key: 'flow', className: 'w-full h-[600px] glass rounded-xl overflow-hidden' },
      React.createElement('div', { key: 'flow-inner' }, 'Flow Placeholder')
    )
  ])
}
