import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Public endpoint - no auth required
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Calculate SHA-256 on server side
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
    const sha256 = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')

    // Call verify-document Edge Function
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/verify-document`
    const edgeFormData = new FormData()
    edgeFormData.append('file', file)

    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      body: edgeFormData
    })

    const result = await response.json()

    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('Verify API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}