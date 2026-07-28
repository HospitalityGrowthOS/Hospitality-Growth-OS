'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Tabs for the Business Intelligence Center.
 *
 * Future modules — Automation Engine, Founder Dashboard, Prediction Engine —
 * are added as one entry here plus a page.
 */
const TABS = [
  { href: '/dashboard/intelligence',               label: 'Executive', exact: true },
  { href: '/dashboard/intelligence/customers',     label: 'Customers' },
  { href: '/dashboard/intelligence/loyalty',       label: 'Loyalty' },
  { href: '/dashboard/intelligence/reviews',       label: 'Reviews' },
  { href: '/dashboard/intelligence/opportunities', label: 'Opportunities' },
  { href: '/dashboard/intelligence/timeline',      label: 'Timeline' },
]

export default function IntelligenceNav() {
  const pathname = usePathname()
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <div className="border-b border-border bg-white px-6">
      <nav className="flex items-center gap-1 overflow-x-auto">
        {TABS.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative px-3 py-3 text-[13px] whitespace-nowrap transition-colors',
              isActive(href, exact) ? 'text-ink font-medium' : 'text-mid hover:text-ink'
            )}
          >
            {label}
            {isActive(href, exact) && (
              <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-ember rounded-full" />
            )}
          </Link>
        ))}
      </nav>
    </div>
  )
}
