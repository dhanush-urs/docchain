import { FileText, FileSpreadsheet, FileImage, FileCode, FileArchive } from 'lucide-react'
import { formatBytes, formatDistanceToNow } from '@/lib/utils'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface DocumentCardProps {
  document: {
    id: string
    filename: string
    original_filename: string
    mime_type: string
    size_bytes: number
    sha256: string
    current_version: number
    verified: boolean
    created_at: string
    workspace_name: string
  }
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

export function DocumentCard({ document }: DocumentCardProps) {
  const Icon = MIME_ICONS[document.mime_type] || FileText

  return (
    <div className="glass rounded-xl p-5 hover:border-primary/50 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <Icon className="h-10 w-10 text-primary group-hover:scale-110 transition-transform" />
        <span className={cn(
          'px-2 py-1 text-xs font-medium rounded-full',
          document.verified ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
        )}>
          {document.verified ? 'Verified' : 'Pending'}
        </span>
      </div>
      <h3 className="font-medium text-lg truncate mb-1">{document.original_filename}</h3>
      <p className="text-sm text-muted-foreground mb-2">
        v{document.current_version} • {formatBytes(document.size_bytes)}
      </p>
      <div className="text-xs font-mono text-muted-foreground/70 mb-3">
        {document.sha256.slice(0, 16)}...
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{document.workspace_name}</span>
        <Link href={`/documents/${document.id}`} className="text-primary hover:underline flex items-center gap-1">
          View
        </Link>
      </div>
    </div>
  )
}