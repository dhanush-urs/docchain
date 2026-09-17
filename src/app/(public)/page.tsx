'use client'

import { useState } from 'react'
import { PublicDocumentList } from '@/components/documents/PublicDocumentList'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function PublicHomepage() {
  const [searchQuery, setSearchQuery] = useState('')
  return (
    <div className="relative min-h-screen bg-[#020817] overflow-hidden text-white flex flex-col">
      {/* Dark glowing grid background */}
      <div 
        className="absolute inset-0 pointer-events-none" 
        style={{
          background: 'radial-gradient(circle at center 40%, rgba(0, 100, 255, 0.15) 0%, transparent 50%)',
        }}
      />
      <div 
        className="absolute bottom-0 left-0 right-0 h-[40vh] pointer-events-none"
        style={{
          background: 'linear-gradient(to top, rgba(0, 80, 255, 0.1), transparent)',
          transform: 'perspective(1000px) rotateX(60deg)',
          transformOrigin: 'bottom',
          backgroundImage: `
            linear-gradient(to right, rgba(0, 100, 255, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(0, 100, 255, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col pt-12 pb-24 min-h-screen">
        {/* Top Login Button is in layout.tsx but let's make sure there is spacing */}
        
        {/* Search Bar */}
        <div className="container mx-auto px-4 mb-20 max-w-3xl">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-blue-400/50" />
            <Input
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-blue-950/20 border border-blue-500/30 rounded-full pl-12 pr-4 py-6 text-lg text-blue-100 placeholder:text-blue-400/50 focus-visible:ring-1 focus-visible:ring-blue-500/50 shadow-[0_0_15px_rgba(0,100,255,0.1)] transition-shadow hover:shadow-[0_0_20px_rgba(0,100,255,0.2)]"
            />
          </div>
        </div>

        {/* Horizontal Chain Container */}
        <div className="flex-1 w-full flex items-start">
          <div className="w-full overflow-x-auto pb-12 pt-8 px-8 sm:px-16 custom-scrollbar hide-scroll-arrows">
            <PublicDocumentList searchQuery={searchQuery} />
          </div>
        </div>
      </div>

      {/* Custom styles for the scrollbar to match the theme */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 20, 50, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 100, 255, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 150, 255, 0.8);
        }
      `}} />
    </div>
  )
}