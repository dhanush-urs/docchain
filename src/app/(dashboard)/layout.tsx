'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, useSidebar } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { WorkspaceSwitcher } from '@/components/WorkspaceSwitcher'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  GitBranch,
  ShieldCheck,
  Search,
  Share2,
  Settings,
  Users,
  LogOut,
  Menu,
  X,
  ChevronRight,
  Home, Plus,
  Trash2
} from 'lucide-react'

const navigation = [
  { name: 'Public Home', href: '/', icon: Home },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
]

const adminNavigation = [
  { name: 'Settings', href: '/dashboard/settings', icon: Settings },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </SidebarProvider>
  )
}

function DashboardLayoutInner({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const { setOpenMobile } = useSidebar()
  const [user, setUser] = useState<{ email: string; full_name: string | null; avatar_url: string | null; role: string } | null>(null)

  // Fetch user profile on mount
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('email, full_name, avatar_url, role')
          .eq('id', authUser.id)
          .single()
        if (profile) {
          setUser(profile)
        }
      }
    }
    fetchUser()
  }, [])


  const deleteBranch = async () => {
    const activeWorkspaceId = document.cookie.split(';').find(c => c.trim().startsWith('active_workspace_id='))?.split('=')[1]
    if (!activeWorkspaceId) return
    
    if (!confirm('Are you absolutely sure you want to delete this active branch? This will delete all documents and blockchain history associated with it. This cannot be undone.')) return
    
    try {
      const res = await fetch('/api/workspaces/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspaceId })
      })
      if (!res.ok) throw new Error('Failed to delete branch')
      
      // Delete cookie and reload so WorkspaceSwitcher falls back to a different branch
      document.cookie = 'active_workspace_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
      window.location.href = '/dashboard'
    } catch (err: any) {
      alert('Error deleting branch: ' + err.message)
    }
  }

  const createBranch = async () => {
    const name = prompt('Enter new event/branch name:')
    if (!name) return
    
    const supabase = createClient()
    const { data: userAuth } = await supabase.auth.getUser()
    
    const { data, error } = await supabase.rpc('create_new_event', {
      event_name: name,
      creator_id: userAuth.user?.id
    })
    
    if (error) {
      alert('Error creating event: ' + error.message)
    } else {
      document.cookie = `active_workspace_id=${data}; path=/; max-age=31536000`
      window.location.href = '/dashboard'
    }
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex min-h-screen bg-background w-full">
      <Sidebar
          className="border-r border-white/10 bg-background"
          collapsible="icon"
        >
          <SidebarContent>
            <SidebarHeader className="h-16">
              <div className="flex items-center justify-between px-4 h-full">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl transition-transform hover:scale-105">
                  <svg className="h-6 w-6 text-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.8)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                    <polyline points="10 9 9 9 8 9" />
                  </svg>
                  {sidebarOpen && <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 text-transparent bg-clip-text">CodeIS Task Tracker</span>}
                </Link>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setOpenMobile(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SidebarHeader>

            {sidebarOpen && <WorkspaceSwitcher user={user} />}

            <SidebarGroup>
              <SidebarMenu>
                {navigation.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton className={cn('gap-3', pathname === item.href && 'bg-primary/10 text-primary')} render={<Link href={item.href} className="flex items-center gap-3 w-full" />}>
                      <item.icon className="h-5 w-5 flex-shrink-0" />
                      <span>{item.name}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}


                {user?.email === 'dhanushurs667@gmail.com' && (
                  <>
                    <SidebarMenuItem>
                      <Separator className="my-2" />
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton onClick={createBranch} className="gap-3 text-blue-400 hover:text-blue-300">
                        <Plus className="h-5 w-5 flex-shrink-0" />
                        <span>Create New Branch</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </>
                )}

                {user?.role === 'admin' && (
                  <>
                    <SidebarMenuItem>
                      <Separator className="my-2" />
                    </SidebarMenuItem>
                    {adminNavigation.map((item) => (
                      <SidebarMenuItem key={item.name}>
                        <SidebarMenuButton className={cn('gap-3', pathname === item.href && 'bg-primary/10 text-primary')} render={<Link href={item.href} className="flex items-center gap-3 w-full" />}>
                          <item.icon className="h-5 w-5 flex-shrink-0" />
                          <span>{item.name}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </>
                )}
              </SidebarMenu>
            </SidebarGroup>

            <SidebarFooter>
              <DropdownMenu>
                <DropdownMenuTrigger render={<SidebarMenuButton className="w-full justify-start gap-3" />}>
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.avatar_url || undefined} />
                    <AvatarFallback>{user?.email?.[0]?.toUpperCase() || 'U'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-medium truncate">{user?.full_name || user?.email || 'User'}</p>
                    <p className="text-xs text-muted-foreground capitalize">{user?.role || 'viewer'}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="font-normal">
                      <div className="flex flex-col space-y-1">
                        <p className="font-medium">{user?.full_name || user?.email}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
                      </div>
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href="/dashboard" className="flex items-center gap-2">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href="/dashboard/settings" className="flex items-center gap-2">
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive flex items-center gap-2">
                    <LogOut className="h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarFooter>
          </SidebarContent>
        </Sidebar>

        {/* Mobile menu button */}
        <button
          className="fixed top-4 left-4 z-50 md:hidden bg-background/80 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-lg"
          onClick={() => setOpenMobile(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Main content */}
        <div className="flex-1 transition-all duration-200 w-full overflow-x-hidden pt-16 md:pt-0">
          {children}
        </div>
      </div>
  )
}