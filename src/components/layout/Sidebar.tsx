'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface SidebarProps {
  userName: string
  userInitials: string
  userEmail: string
  venueName: string
  venueInitials: string
  planName?: string | null
}

const NAV = [
  {
    section: 'Overview',
    items: [
      { href: '/dashboard', label: 'Command Centre', icon: HomeIcon, exact: true },
      { href: '/dashboard/analytics', label: 'Growth Intelligence', icon: ChartIcon },
    ],
  },
  {
    section: 'Guest Systems',
    items: [
      { href: '/dashboard/reviews', label: 'Reviews', icon: StarIcon, badge: 3 },
      { href: '/dashboard/loyalty', label: 'Loyalty Members', icon: HeartIcon },
      { href: '/dashboard/whatsapp', label: 'WhatsApp', icon: WhatsAppIcon },
      { href: '/dashboard/ai', label: 'AI Assistant', icon: ChatIcon, badge: 2 },
    ],
  },
  {
    section: 'Marketing',
    items: [
      { href: '/dashboard/campaigns', label: 'Campaigns', icon: SendIcon },
      { href: '/dashboard/guests', label: 'Guest CRM', icon: UsersIcon },
    ],
  },
  {
    section: 'Setup',
    items: [
      { href: '/dashboard/onboarding', label: 'Onboarding', icon: CheckIcon },
      { href: '/dashboard/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

export default function Sidebar({ userName, userInitials, userEmail, venueName, venueInitials, planName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href)

  return (
    <aside className="w-[260px] bg-ink h-screen flex flex-col flex-shrink-0 relative z-10">
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/[0.08] flex items-center gap-3">
        <svg width="34" height="34" viewBox="0 0 56 56" fill="none">
          <rect width="56" height="56" rx="8" fill="#E85D26"/>
          <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
          <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
          <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
          <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <div>
          <div className="font-display font-semibold text-[17px] text-paper leading-tight">Hospitality Growth</div>
          <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-mid">AI Revenue Platform</div>
        </div>
      </div>

      {/* Venue switcher */}
      <div className="mx-3 my-3 bg-white/[0.04] border border-white/[0.08] rounded-lg p-2.5 flex items-center gap-2.5 cursor-pointer hover:bg-white/[0.07] transition-colors">
        <div className="w-8 h-8 rounded-md bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center text-white text-xs font-bold font-display flex-shrink-0">{venueInitials}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold text-paper truncate">{venueName}</div>
          <div className="text-[10px] text-gold uppercase tracking-[0.1em]">{planName ? `${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` : 'Free Trial'}</div>
        </div>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mid flex-shrink-0"><polyline points="6,9 12,15 18,9"/></svg>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV.map(({ section, items }) => (
          <div key={section}>
            <div className="px-5 pt-4 pb-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-mid/60">{section}</div>
            {items.map(({ href, label, icon: Icon, badge, exact }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-[13px] transition-all relative',
                  isActive(href, exact)
                    ? 'bg-ember/15 text-paper'
                    : 'text-paper/55 hover:bg-white/[0.06] hover:text-paper/90'
                )}
              >
                {isActive(href, exact) && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-[18px] w-[3px] bg-ember rounded-r-full"/>
                )}
                <Icon className={cn('w-4 h-4 flex-shrink-0', isActive(href, exact) ? 'opacity-100' : 'opacity-70')}/>
                <span className="flex-1">{label}</span>
                {badge && (
                  <span className="bg-ember text-white text-[10px] font-bold font-data px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {badge}
                  </span>
                )}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/[0.08]">
        <div className="flex items-center gap-2.5 p-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal to-[#0f5c76] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{userInitials}</div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-paper truncate">{userName}</div>
            {userEmail && <div className="text-[10px] text-mid truncate">{userEmail}</div>}
          </div>
          <button
            onClick={handleSignOut}
            title="Sign out"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-mid hover:text-ember hover:bg-white/[0.06] transition-colors flex-shrink-0"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16,17 21,12 16,7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </div>
    </aside>
  )
}

// ── Icons ─────────────────────────────────────────────────────
function HomeIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
}
function ChartIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>
}
function StarIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>
}
function HeartIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
}
function ChatIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>
}
function SendIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22,2 15,22 11,13 2,9"/></svg>
}
function UsersIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
}
function CheckIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
}
function WhatsAppIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
}
function SettingsIcon({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/></svg>
}
