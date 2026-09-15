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
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Documents', href: '/dashboard/documents', icon: FileText },
  { name: 'Blockchain', href: '/dashboard/blockchain', icon: ShieldCheck },
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

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="min-h-screen bg-background w-full">
      <Sidebar
          className={cn(
            'border-r border-white/10 bg-background transition-all duration-200',
            sidebarOpen ? 'w-64' : 'w-20'
          )}
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
          className="fixed top-4 left-4 z-50 md:hidden glass rounded-lg p-2"
          onClick={() => setOpenMobile(true)}
        >
          <Menu className="h-5 w-5" />
        </button>

        {/* Main content */}
        <div className="flex-1 lg:pl-64 transition-all duration-200">
          {children}
        </div>
      </div>
  )
}