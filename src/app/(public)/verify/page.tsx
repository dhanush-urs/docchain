'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FileText, Search, CheckCircle, AlertCircle, Loader2, Copy, Hash, Eye, Download, ArrowRight, GitBranch, ShieldCheck, LogIn, FileText as FileTextIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { cn, formatDistanceToNow, formatBytes } from '@/lib/utils'

export default function VerificationPage() {
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'authentic' | 'modified' | 'not_found' | 'compromised'>('idle')
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const supabase = createClient()

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const verifyFile = async (fileToVerify: File) => {
    setStatus('loading')
    setError(null)
    setResult(null)

    try {
      // Calculate SHA-256 client-side for immediate feedback
      const arrayBuffer = await fileToVerify.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const sha256 = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('')

      // Call verification API
      const formData = new FormData()
      formData.append('file', fileToVerify)

      const response = await fetch('/api/verify', {
        method: 'POST',
        body: formData
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Verification failed')
      }

      setResult({ ...result, sha256 })
      
      if (result.status === 'authentic') {
        setStatus('authentic')
      } else if (result.status === 'modified') {
        setStatus('modified')
      } else if (result.status === 'not_found') {
        setStatus('not_found')
      } else if (result.status === 'compromised') {
        setStatus('compromised')
      } else {
        setStatus('not_found')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
      setStatus('not_found')
    }
  }

  const handleVerify = () => {
    if (file) {
      verifyFile(file)
    }
  }

  const handleRetry = () => {
    setStatus('idle')
    setFile(null)
    setResult(null)
    setError(null)
  }

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto">
          {/* Hero */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-6">
              <Search className="h-10 w-10 text-primary" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Document Verification
            </h1>
            <p className="text-lg text-muted-foreground mb-10 max-w-2xl mx-auto">
              Upload a document to verify its authenticity against the DocChain provenance ledger.
              The system will calculate the SHA-256 fingerprint and check it against registered documents.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="gap-2 px-8 py-3 text-lg" onClick={() => document.getElementById('file-upload')?.click()}>
                <FileText className="h-5 w-5" />
                Browse Files
              </Button>
            </div>
          </div>

          {/* Drop Zone / File Input */}
          <Card className={cn(
            'glass border-2 transition-all duration-200',
            dragActive ? 'border-primary bg-primary/5' : 'border-white/10'
          )}>
            <CardContent className="pt-6">
              {status === 'idle' && (
                <div className="text-center py-12">
                  <div className="relative">
                    <input
                      id="file-upload"
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                        <FileText className="h-10 w-10 text-primary" />
                      </div>
                      <h3 className="text-xl font-medium mb-2">Drop a file or click to select</h3>
                      <p className="text-muted-foreground mb-4">
                        Supports PDF, DOC, DOCX, TXT, CSV, JSON, XML, MD, XLS, XLSX, PPT, PPTX, PNG, JPG, WEBP, GIF, SVG, ZIP
                      </p>
                      <p className="text-xs text-muted-foreground">Maximum file size: 50MB</p>
                    </label>
                  </div>
                </div>
              )}

              {file && status === 'idle' && (
                <div className="py-8">
                  <div className="flex items-center justify-center gap-4 mb-6 p-4 glass rounded-lg">
                    <FileText className="h-10 w-10 text-primary" />
                    <div className="text-left">
                      <p className="font-medium truncate max-w-md">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{file.type || 'Unknown type'} • {file.size > 1024 * 1024 ? (file.size / 1024 / 1024).toFixed(2) + ' MB' : (file.size / 1024).toFixed(1) + ' KB'}</p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-4">
                    <Button variant="outline" onClick={() => setFile(null)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Change File
                    </Button>
                    <Button onClick={handleVerify} size="lg">
                      <Search className="h-4 w-4 mr-2" />
                      Verify Document
                    </Button>
                  </div>
                </div>
              )}

              {status === 'loading' && (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto mb-6" />
                  <h3 className="text-xl font-medium mb-2">Verifying Document...</h3>
                  <p className="text-muted-foreground">Calculating SHA-256 and checking provenance ledger</p>
                </div>
              )}

              {status === 'authentic' && result && (
                <div className="py-8 space-y-6">
                  <Alert className="border-green-500/50 bg-green-500/10">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <AlertDescription className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-green-500">AUTHENTIC DOCUMENT</span>
                        <Badge variant="default" className="ml-auto">VERIFIED</Badge>
                      </div>
                      <p className="text-green-700 dark:text-green-300">
                        This document matches a registered fingerprint in the DocChain provenance ledger.
                        The blockchain integrity check passed.
                      </p>
                    </AlertDescription>
                  </Alert>

                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>Document Details</CardTitle>
                      <CardDescription>Verified against the provenance ledger</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs text-muted-foreground">Document</p>
                          <p className="font-medium">{result.document?.filename || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Original Name</p>
                          <p className="font-medium truncate">{result.document?.original_filename || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Version</p>
                          <p className="font-medium font-mono">v{result.document?.version || '1'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">SHA-256</p>
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-xs bg-muted px-2 py-1 rounded flex-1 truncate">{result.sha256}</code>
                            <Button variant="ghost" size="icon" onClick={() => copyHash(result.sha256)} className="h-6 w-6">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Uploaded</p>
                          <p className="font-medium">{result.document?.uploaded_at ? formatDistanceToNow(result.document.uploaded_at) + ' ago' : 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Block</p>
                          <p className="font-medium font-mono">#{result.document?.block || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Block Hash</p>
                          <p className="font-mono text-xs truncate max-w-full">{result.document?.block_hash || 'Unknown'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Chain Status</p>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-500" />
                            <span className="font-medium text-green-500">VALID</span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between">
                      <Button variant="outline" onClick={handleRetry}>
                        <FileText className="h-4 w-4 mr-2" />
                        Verify Another
                      </Button>
                      <Button onClick={() => window.open(`/verify?doc=${result.document?.id}`, '_blank')}>
                        <ArrowRight className="h-4 w-4 mr-2" />
                        View Full Provenance
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {status === 'modified' && result && (
                <div className="py-8 space-y-6">
                  <Alert className="border-yellow-500/50 bg-yellow-500/10">
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                    <AlertDescription className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-yellow-500">DOCUMENT MODIFIED</span>
                        <Badge variant="destructive" className="ml-auto">MISMATCH</Badge>
                      </div>
                      <p className="text-yellow-700 dark:text-yellow-300">
                        The uploaded file does not match the registered fingerprint for this document.
                        The document has been modified since it was registered in DocChain.
                      </p>
                    </AlertDescription>
                  </Alert>

                  <Card className="glass">
                    <CardHeader>
                      <CardTitle>Hash Comparison</CardTitle>
                      <CardDescription>The submitted file hash differs from the registered hash</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 glass rounded-lg border border-red-500/50 bg-red-500/5">
                          <p className="text-xs text-muted-foreground mb-2">Submitted Hash</p>
                          <code className="font-mono text-xs bg-muted px-2 py-1 rounded w-full truncate block">{result.submitted_hash}</code>
                          <p className="text-xs text-red-500 mt-2">Does not match</p>
                        </div>
                        <div className="p-4 glass rounded-lg border border-green-500/50 bg-green-500/5">
                          <p className="text-xs text-muted-foreground mb-2">Registered Hash</p>
                          <code className="font-mono text-xs bg-muted px-2 py-1 rounded w-full truncate block">{result.registered_hash}</code>
                          <p className="text-xs text-green-500 mt-2">Original fingerprint</p>
                        </div>
                      </div>
                      {result.document && (
                        <div className="p-4 glass rounded-lg">
                          <p className="text-xs text-muted-foreground mb-2">Document Info</p>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground">Document</p>
                              <p className="font-medium truncate">{result.document.filename}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Version</p>
                              <p className="font-medium">v{result.document.version}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Block</p>
                              <p className="font-mono">#{result.document.block}</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Uploaded</p>
                              <p>{formatDistanceToNow(result.document.uploaded_at) + ' ago'}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                      <Button variant="outline" onClick={handleRetry}>
                        <FileText className="h-4 w-4 mr-2" />
                        Try Another File
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {status === 'not_found' && (
                <div className="py-8 space-y-6 text-center">
                  <Alert className="border-gray-500/50 bg-gray-500/10">
                    <AlertCircle className="h-5 w-5 text-gray-500" />
                    <AlertDescription className="flex flex-col gap-2">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-bold text-gray-500">DOCUMENT NOT FOUND</span>
                        <Badge variant="secondary" className="ml-auto">NO MATCH</Badge>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400">
                        This file does not match any registered document in the DocChain provenance ledger.
                        It may be a new document or one that was never registered.
                      </p>
                    </AlertDescription>
                  </Alert>

                  <Card className="glass max-w-md mx-auto">
                    <CardHeader>
                      <CardTitle>Submitted File</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="p-4 glass rounded-lg">
                        <p className="text-xs text-muted-foreground">SHA-256</p>
                        <code className="font-mono text-xs bg-muted px-2 py-1 rounded w-full truncate block">{result?.sha256 || 'Calculating...'}</code>
                        <Button variant="ghost" size="icon" onClick={() => copyHash(result?.sha256)} className="ml-auto">
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                      {file && (
                        <div className="p-4 glass rounded-lg">
                          <p className="text-xs text-muted-foreground">File</p>
                          <p className="font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex justify-center">
                      <Button variant="outline" onClick={handleRetry}>
                        <FileText className="h-4 w-4 mr-2" />
                        Try Another File
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}

              {status === 'compromised' && result && (
                <div className="py-8 space-y-6">
                  <Alert className="border-red-500/50 bg-red-500/10">
                    <AlertCircle className="h-5 w-5 text-red-500" />
                    <AlertDescription className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-red-500">BLOCKCHAIN COMPROMISED</span>
                        <Badge variant="destructive" className="ml-auto">INVALID CHAIN</Badge>
                      </div>
                      <p className="text-red-700 dark:text-red-300">
                        The document fingerprint matches a registered document, but the blockchain integrity check failed.
                        The provenance chain has been tampered with. This document's history cannot be trusted.
                      </p>
                    </AlertDescription>
                  </Alert>

                  <Card className="glass border-red-500/50">
                    <CardHeader>
                      <CardTitle>Chain Validation Failed</CardTitle>
                      <CardDescription>One or more blocks in the chain have invalid hashes</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        The document's provenance chain contains invalid cryptographic links. This indicates
                        that historical records have been modified after being added to the blockchain.
                      </p>
                    </CardContent>
                    <CardFooter className="flex justify-center">
                      <Button variant="destructive" onClick={handleRetry}>
                        <FileText className="h-4 w-4 mr-2" />
                        Try Another File
                      </Button>
                    </CardFooter>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <footer className="border-t border-white/10 bg-background/50 py-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>© {new Date().getFullYear()} DocChain. Cryptographically verifiable document provenance.</p>
        </div>
      </footer>
    </div>
  )
}