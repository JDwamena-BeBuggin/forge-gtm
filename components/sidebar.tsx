'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'
import {
  LayoutDashboard, Users, Sparkles, BarChart3, Send, Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/enrichment', label: 'Enrichment', icon: Sparkles },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/outreach', label: 'Outreach', icon: Send },
]

export function Sidebar({ authEnabled }: { authEnabled: boolean }) {
  const pathname = usePathname()

  return (
    <aside className="w-56 flex-shrink-0 flex flex-col h-screen bg-[#1a1814] text-[#c9c3b8]">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-[#2a2620]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#c2410c] flex items-center justify-center">
            <Zap size={14} className="text-white" />
          </div>
          <div>
            <span className="font-serif text-white text-lg leading-none block">Forge GTM</span>
            <span className="text-[11px] uppercase tracking-[0.18em] text-[#8c8578]">Lead Intelligence Hub</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-[#c2410c]/20 text-white'
                  : 'hover:bg-[#2a2620] hover:text-white',
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-[#2a2620] flex items-center gap-3">
        {authEnabled ? (
          <>
            <UserButton afterSignOutUrl="/sign-in" />
            <span className="text-xs text-[#6b6560] font-mono truncate">joshdwamena</span>
          </>
        ) : (
          <span className="text-xs text-[#9b9589]">Auth setup required</span>
        )}
      </div>
    </aside>
  )
}
