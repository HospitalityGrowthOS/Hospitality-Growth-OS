'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Tabs for the AI Command Center.
 *
 * Future modules (Workflows, Voice, Memory, Training) are added as one entry
 * here plus a page — no change to anything already built.
 */
const TABS = [
  { href: '/dashboard/ai',               label: 'Overview',      exact: true },
  { href: '/dashboard/ai/console',       label: 'Console' },
  { href: '/dashboard/ai/conversations', label: 'Conversations' },
  { href: '/dashboard/ai/knowledge',     label: 'Knowledge Base' },
  { href: '/dashboard/ai/settings',      label: 'Configuration' },
]

export default function AiNav() {
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
              isActive(href, exact)
                ? 'text-ink font-medium'
                : 'text-mid hover:text-ink'
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
