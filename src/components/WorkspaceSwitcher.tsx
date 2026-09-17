'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function WorkspaceSwitcher({ user }: { user: any }) {
  const [workspaces, setWorkspaces] = useState<any[]>([])
  const [activeWorkspace, setActiveWorkspace] = useState<any>(null)


  useEffect(() => {
    fetchWorkspaces()
  }, [])

  const fetchWorkspaces = async () => {
    const res = await fetch('/api/workspaces')
    const json = await res.json()
    const data = json.workspaces
    if (data && data.length > 0) {
      setWorkspaces(data)
      
      // Check cookie
      const cookies = document.cookie.split(';')
      const activeCookie = cookies.find(c => c.trim().startsWith('active_workspace_id='))
      if (activeCookie) {
        const id = activeCookie.split('=')[1]
        const ws = data.find((w: any) => w.id === id)
        if (ws) setActiveWorkspace(ws)
        else setActiveWorkspace(data[0])
      } else {
        setActiveWorkspace(data[0])
      }
    }
  }

  const switchWorkspace = (ws: any) => {
    document.cookie = `active_workspace_id=${ws.id}; path=/; max-age=31536000`
    setActiveWorkspace(ws)
    window.location.reload()
  }

  if (!workspaces.length) return null

  return (
    <div className="px-4 pb-2">
      <DropdownMenu>
        <DropdownMenuTrigger {...{ asChild: true } as any}>
          <Button variant="outline" role="combobox" className="w-full justify-between glass border-white/10 hover:bg-white/5">
            <span className="truncate">{activeWorkspace?.name || 'Select Event'}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 glass border-white/10">
          {workspaces.map((ws) => (
            <DropdownMenuItem key={ws.id} onClick={() => switchWorkspace(ws)} className="cursor-pointer">
              <Check className={`mr-2 h-4 w-4 ${activeWorkspace?.id === ws.id ? 'opacity-100' : 'opacity-0'}`} />
              <span className="truncate">{ws.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
