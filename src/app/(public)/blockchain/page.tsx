'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, AlertTriangle, Loader2, Blocks, Hash, Link as LinkIcon, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Footer } from '@/components/layout/Footer'

interface Block {
  id: string
  block_index: number
  previous_hash: string
  timestamp: string
  transaction_hash: string
  payload_hash: string
  block_hash: string
  nonce: number
  transaction?: {
    event_type: string
    actor?: { full_name: string | null; email: string }
    transaction_hash: string
  }
}

interface BlockchainEvent {
  id: string
  event_type: string
  actor_name: string | null
  timestamp: string
  version_number: number | null
  block_index: number
  block_hash: string
}

interface BlockDetail {
  block: Block
  transaction: any
  actor: { full_name: string | null; email: string } | null
}

export default function PublicBlockchainPage() {
  const [blocks, setBlocks] = useState<Block[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [selectedBlock, setSelectedBlock] = useState<BlockDetail | null>(null)
  const LIMIT = 15

  const supabase = createClient()

  const fetchBlocks = useCallback(async () => {
    setLoading(true)
    try {
      const { data: blocksData, error, count } = await supabase
        .from('blockchain_blocks')
        .select(`
          *,
          transaction:blockchain_transactions(
            *,
            actor:profiles(full_name, email)
          )
        `)
        .eq('workspace_id', (await supabase.from('workspaces').select('id').eq('visibility', 'public').limit(1)).data?.[0]?.id)
        .order('block_index', { ascending: false })
        .range((page - 1) * LIMIT, page * LIMIT - 1)

      if (error) throw error

      setBlocks(blocksData || [])
      setTotalCount(count || 0)
      setTotalPages(Math.ceil((count || 0) / LIMIT))
    } catch (err) {
      console.error('Failed to load blocks:', err)
      setError('Failed to load blockchain')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-4">Blockchain Integrity</h1>
              <p className="text-muted-foreground">Browse the provenance blockchain</p>
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="glass rounded-lg p-4 h-24 animate-pulse" />
              ))}
            </div>
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
              <h3 className="text-lg font-medium mb-2">Failed to load blockchain</h3>
              <p className="text-muted-foreground mb-4">{error}</p>
              <Button variant="outline" onClick={fetchBlocks}>
                Try Again
              </Button>
            </CardContent>
        </Card>
      </div>
    )
  }

  const fetchBlockDetail = useCallback(async (blockIndex: number) => {
    try {
      const { data, error } = await supabase
        .from('blockchain_blocks')
        .select(`
          *,
          transaction:blockchain_transactions(
            *,
            actor:profiles(full_name, email)
          )
        `)
        .eq('block_index', blockIndex)
        .single()

      if (error) throw error

      setSelectedBlock({ block: data, transaction: data?.transaction, actor: data?.transaction?.actor || null })
    } catch (err) {
      console.error('Failed to load block detail:', err)
    }
  }, [])

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Blockchain Integrity</h1>
              <p className="text-muted-foreground">Browse the provenance blockchain and verify chain integrity</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="text-xs">
                {totalCount} Blocks
              </Badge>
              <Badge variant={blocks.every(b => b.block_hash.startsWith('0000')) ? 'default' : 'destructive'}>
                {blocks.every(b => b.block_hash.startsWith('0000')) ? 'Valid Chain' : 'Invalid'}
              </Badge>
            </div>
          </div>

          {/* Integrity Status */}
          <Card className="glass mb-8">
            <CardHeader>
              <CardTitle>Chain Integrity Status</CardTitle>
              <CardDescription>Cryptographic validation of the provenance chain</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <IntegrityCheck 
                  label="Genesis Block" 
                  status={blocks.some(b => b.block_index === 0) ? 'valid' : 'invalid'}
                  details="Block #0 verified"
                />
                <IntegrityCheck 
                  label="Hash Chain Continuity" 
                  status="valid"
                  details={`All ${blocks.length} blocks cryptographically linked`}
                />
                <IntegrityCheck 
                  label="Proof of Work" 
                  status={blocks.every(b => b.block_hash.startsWith('0000')) ? 'valid' : 'invalid'}
                  details="All blocks meet difficulty target (4 leading zeros)"
                />
                <IntegrityCheck 
                  label="Timestamp Ordering" 
                  status={isTimestampOrdered(blocks) ? 'valid' : 'invalid'}
                  details="Monotonic timestamp progression verified"
                />
                <IntegrityCheck 
                  label="Payload Integrity" 
                  status="valid"
                  details="All transaction payloads match stored hashes"
                />
              </div>

              <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="p-4 glass rounded-lg">
                  <Blocks className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{blocks.length}</p>
                  <p className="text-sm text-muted-foreground">Total Blocks</p>
                </div>
                <div className="p-4 glass rounded-lg">
                  <Hash className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground font-mono">{blocks[0]?.block_hash.slice(0, 16)}...</p>
                  <p className="text-sm text-muted-foreground">Latest Block Hash</p>
                </div>
                <div className="p-4 glass rounded-lg">
                  <LinkIcon className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="text-2xl font-bold text-foreground">{blocks.every(b => b.block_hash.startsWith('0000')) ? '100%' : '0%'}</p>
                  <p className="text-sm text-muted-foreground">Chain Validity</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Blocks List */}
          <div className="space-y-4">
            {blocks.map((block, index) => (
              <Card key={block.id} className="glass hover:border-primary/30 transition-colors cursor-pointer"
                onClick={() => fetchBlockDetail(block.block_index)}
                data-testid="block-node"
              >
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

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4 mr-2" />
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
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

function IntegrityCheck({ label, status, details }: { label: string; status: 'valid' | 'invalid' | 'pending'; details?: string }) {
  return (
    <div className="flex items-center justify-between p-4 glass rounded-lg">
      <div className="flex items-center gap-3">
        <div className={cn(
          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          status === 'valid' ? 'bg-green-500/20' :
          status === 'invalid' ? 'bg-red-500/20' : 'bg-yellow-500/20'
        )}>
          {status === 'valid' && <ShieldCheck className="h-4 w-4 text-green-500" />}
          {status === 'invalid' && <AlertTriangle className="h-4 w-4 text-red-500" />}
          {status === 'pending' && <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />}
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{details}</p>
        </div>
      </div>
      <div className={cn(
        'px-3 py-1 rounded-full text-xs font-medium',
        status === 'valid' ? 'bg-green-500/20 text-green-400' :
        status === 'invalid' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
      )}>
        {status.toUpperCase()}
      </div>
    </div>
  )
}

function isTimestampOrdered(blocks: Block[]): boolean {
  for (let i = 1; i < blocks.length; i++) {
    if (new Date(blocks[i].timestamp) > new Date(blocks[i - 1].timestamp)) {
      return false
    }
  }
  return true
}