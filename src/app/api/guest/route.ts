import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const adminSupabase = createAdminClient()
    
    // Get workspace
    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!member) {
      return NextResponse.json({ error: 'Not a member' }, { status: 403 })
    }

    const { data, error } = await adminSupabase
      .from('guest_links')
      .select('*, workspace:workspaces(name)')
      .eq('workspace_id', member.workspace_id)
      .order('created_at', { ascending: false })

    if (error) throw error
    return NextResponse.json({ links: data || [], role: member.role })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { documentId, permissions, expiresAt } = body

    const validPermissions = ['timeline', 'documents', 'versions', 'comments', 'blockchain']
    const finalPermissions = Array.isArray(permissions) 
      ? permissions.filter((p: string) => validPermissions.includes(p)) 
      : []

    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!member || !['admin', 'editor'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const workspaceId = member.workspace_id
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')

    const { data: guestLink, error } = await adminSupabase
      .from('guest_links')
      .insert({
        token,
        workspace_id: workspaceId,
        document_id: documentId || null,
        created_by: user.id,
        permissions: finalPermissions,
        expires_at: expiresAt || null,
        revoked: false
      })
      .select()
      .single()

    if (error) throw error

    await adminSupabase.from('audit_logs').insert({
      workspace_id: workspaceId,
      actor_id: user.id,
      action: 'GUEST_LINK_CREATED',
      target_type: 'guest_link',
      target_id: guestLink.id,
      metadata: { document_id: documentId, permissions: finalPermissions, expires_at: expiresAt }
    })

    return NextResponse.json(guestLink, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()
    const adminSupabase = createAdminClient()
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const linkId = searchParams.get('linkId')

    if (!linkId) {
      return NextResponse.json({ error: 'Missing linkId' }, { status: 400 })
    }

    const { data: linkData } = await adminSupabase.from('guest_links').select('workspace_id').eq('id', linkId).single()
    if (!linkData) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const { data: member } = await adminSupabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', linkData.workspace_id)
      .eq('user_id', user.id)
      .single()

    if (!member || !['admin', 'editor'].includes(member.role)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 })
    }

    const { error } = await adminSupabase
      .from('guest_links')
      .update({ revoked: true })
      .eq('id', linkId)

    if (error) throw error

    await adminSupabase.from('audit_logs').insert({
      workspace_id: linkData.workspace_id,
      actor_id: user.id,
      action: 'GUEST_LINK_REVOKED',
      target_type: 'guest_link',
      target_id: linkId,
      metadata: {}
    })

    return NextResponse.json({ message: 'Guest link revoked' })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}