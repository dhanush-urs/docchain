import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDistanceToNow(date: string | Date) {
  const now = new Date()
  const then = new Date(date)
  const diff = now.getTime() - then.getTime()

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return `${seconds}s ago`
}

export function truncate(str: string, length: number) {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function shortenHash(hash: string, length = 8) {
  return hash.slice(0, length) + '...'
}

export function getFileIcon(mimeType: string) {
  const icons: Record<string, string> = {
    'application/pdf': 'FileText',
    'application/msword': 'FileText',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'FileText',
    'text/plain': 'FileText',
    'text/csv': 'FileSpreadsheet',
    'application/json': 'FileJson',
    'text/xml': 'FileCode',
    'application/xml': 'FileCode',
    'text/markdown': 'FileText',
    'application/vnd.ms-excel': 'FileSpreadsheet',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'FileSpreadsheet',
    'application/vnd.ms-powerpoint': 'FileSlides',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'FileSlides',
    'image/png': 'FileImage',
    'image/jpeg': 'FileImage',
    'image/webp': 'FileImage',
    'image/gif': 'FileImage',
    'image/svg+xml': 'FileImage',
    'application/zip': 'FileArchive',
  }
  return icons[mimeType] || 'File'
}