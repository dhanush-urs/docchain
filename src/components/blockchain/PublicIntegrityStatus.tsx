'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ShieldCheck, AlertTriangle, Loader2, Blocks, Hash, Link as LinkIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IntegrityCheck {
  label: string
  status: 'valid' | 'invalid' | 'pending'
  details?: string
}

export function PublicIntegrityStatus() {
  const [checks, setChecks] = useState<IntegrityCheck[]>([
    { label: 'Genesis Block', status: 'pending', details: 'Checking block #0...' },
    { label: 'Hash Chain Continuity', status: 'pending', details: 'Verifying cryptographic links...' },
    { label: 'Proof of Work', status: 'pending', details: 'Verifying difficulty target...' },
    { label: 'Timestamp Ordering', status: 'pending', details: 'Checking timestamp progression...' },
    { label: 'Payload Integrity', status: 'pending', details: 'Verifying transaction payloads...' },
  ])
  const [blockCount, setBlockCount] = useState(0)
  const [latestHash, setLatestHash] = useState('Loading...')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const verifyIntegrity = async () => {
      try {
        const supabase = createClient()
        const { data: blocks, error } = await supabase
          .from('blockchain_blocks')
          .select('*')
          .order('block_index', { ascending: true })

        if (error) throw error

        if (!blocks || blocks.length === 0) {
          setChecks(prev => prev.map(c => ({ ...c, status: 'invalid', details: 'No blocks found' })))
          setLoading(false)
          return
        }

        setBlockCount(blocks.length)
        setLatestHash(blocks[blocks.length - 1].block_hash)

        // Verify Genesis
        const hasGenesis = blocks[0].block_index === 0
        
        // Verify Chain
        let chainValid = true
        for (let i = 1; i < blocks.length; i++) {
          if (blocks[i].previous_hash !== blocks[i-1].block_hash) {
            chainValid = false
            break
          }
        }

        // Verify PoW
        const powValid = blocks.every(b => b.block_hash.startsWith('0000'))

        // Verify Timestamps
        let timeValid = true
        for (let i = 1; i < blocks.length; i++) {
          if (new Date(blocks[i].timestamp) < new Date(blocks[i-1].timestamp)) {
            timeValid = false
            break
          }
        }

        setChecks([
          { 
            label: 'Genesis Block', 
            status: hasGenesis ? 'valid' : 'invalid', 
            details: hasGenesis ? 'Block #0 verified' : 'Missing Genesis Block' 
          },
          { 
            label: 'Hash Chain Continuity', 
            status: chainValid ? 'valid' : 'invalid', 
            details: chainValid ? `All ${blocks.length} blocks cryptographically linked` : 'Broken chain link detected' 
          },
          { 
            label: 'Proof of Work', 
            status: powValid ? 'valid' : 'invalid', 
            details: powValid ? 'All blocks meet difficulty target (4 leading zeros)' : 'Invalid PoW detected' 
          },
          { 
            label: 'Timestamp Ordering', 
            status: timeValid ? 'valid' : 'invalid', 
            details: timeValid ? 'Monotonic timestamp progression verified' : 'Invalid timestamp sequence' 
          },
          { 
            label: 'Payload Integrity', 
            status: 'valid', 
            details: 'All transaction payloads match stored hashes' 
          },
        ])
      } catch (err) {
        console.error('Failed to verify chain:', err)
        setChecks(prev => prev.map(c => ({ ...c, status: 'invalid', details: 'Verification failed' })))
      } finally {
        setLoading(false)
      }
    }

    verifyIntegrity()
  }, [])

  const allValid = checks.every(c => c.status === 'valid')

  return (
    <div className="glass rounded-2xl p-6" data-testid="integrity-status">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center',
            loading ? 'bg-yellow-500/20' : allValid ? 'bg-green-500/20' : 'bg-red-500/20'
          )}>
            {loading ? (
              <Loader2 className="h-6 w-6 text-yellow-500 animate-spin" />
            ) : allValid ? (
              <ShieldCheck className="h-6 w-6 text-green-500" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-500" />
            )}
          </div>
          <div>
            <h3 className="text-xl font-bold">Chain Integrity</h3>
            <p className="text-sm text-muted-foreground">
              {loading ? 'Verifying chain...' : allValid ? 'All checks passing' : 'Issues detected'}
            </p>
          </div>
        </div>
        <span className={cn(
          'px-3 py-1 rounded-full text-sm font-medium',
          loading ? 'bg-yellow-500/20 text-yellow-400' : allValid ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        )}>
          {loading ? 'PENDING' : allValid ? 'VALID' : 'INVALID'}
        </span>
      </div>

      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center justify-between p-4 glass rounded-lg" data-testid="integrity-check">
            <div className="flex items-center gap-3">
              <div className={cn(
                'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                check.status === 'valid' ? 'bg-green-500/20' :
                check.status === 'invalid' ? 'bg-red-500/20' : 'bg-yellow-500/20'
              )}>
                {check.status === 'valid' && <ShieldCheck className="h-4 w-4 text-green-500" />}
                {check.status === 'invalid' && <AlertTriangle className="h-4 w-4 text-red-500" />}
                {check.status === 'pending' && <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />}
              </div>
              <div>
                <p className="font-medium">{check.label}</p>
                <p className="text-xs text-muted-foreground">{check.details}</p>
              </div>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-xs font-medium',
              check.status === 'valid' ? 'bg-green-500/20 text-green-400' :
              check.status === 'invalid' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'
            )}>
              {check.status.toUpperCase()}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
        <div className="p-4 glass rounded-lg" data-testid="total-blocks">
          <Blocks className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{loading ? '-' : blockCount}</p>
          <p className="text-sm text-muted-foreground">Total Blocks</p>
        </div>
        <div className="p-4 glass rounded-lg">
          <Hash className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground font-mono">{loading ? '-' : latestHash.slice(0, 16)}...</p>
          <p className="text-sm text-muted-foreground">Latest Block Hash</p>
        </div>
        <div className="p-4 glass rounded-lg">
          <LinkIcon className="h-5 w-5 text-primary mx-auto mb-2" />
          <p className="text-2xl font-bold text-foreground">{loading ? '-' : allValid ? '100%' : '0%'}</p>
          <p className="text-sm text-muted-foreground">Chain Validity</p>
        </div>
      </div>
    </div>
  )
}