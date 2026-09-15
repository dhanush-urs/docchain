'use client'

import Link from 'next/link'
import { LogIn, LayoutDashboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function PublicHeader() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null)

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      setIsLoggedIn(!!session)
    }
    checkSession()
  }, [])

  return (
    <header className="border-b border-white/10 bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 relative">
        <div className="w-24"></div>
        
        <Link 
          href="/" 
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center font-extrabold text-4xl tracking-tight transition-transform hover:scale-105"
        >
          <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 text-transparent bg-clip-text drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]">
            CodeIS Task Tracker
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {isLoggedIn === null ? (
            <div className="w-24 h-10"></div> /* placeholder to prevent flicker */
          ) : isLoggedIn ? (
            <Link href="/dashboard">
              <Button variant="default" className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/50">
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button variant="default" className="gap-2 bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.5)] border border-blue-400/50">
                <LogIn className="h-4 w-4" />
                Login
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
