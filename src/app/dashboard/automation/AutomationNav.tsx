'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { href: '/dashboard/automation',            label: 'Overview', exact: true },
  { href: '/dashboard/automation/workflows',  label: 'Workflows' },
  { href: '/dashboard/automation/executions', label: 'History' },
  { href: '/dashboard/automation/templates',  label: 'Templates' },
]

export default function AutomationNav() {
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
              'px-4 py-3 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors',
              isActive(href, exact)
                ? 'border-ember text-ink font-medium'
                : 'border-transparent text-mid hover:text-ink'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
