import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number, currency = 'EUR', locale = 'de-DE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export function formatDate(date: string | Date, locale = 'de-DE'): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date))
}

export function formatRelativeTime(date: string | Date): string {
  const now = Date.now()
  const then = new Date(date).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function generateQRCode(venueSlug: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const random = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `HGOS-${venueSlug.toUpperCase().substring(0, 4)}-${random}`
}

/**
 * @deprecated Prefer `tierFor(points, tierThresholds(venue.settings))` from
 * `@/lib/tiers` — it reads the venue's own configuration. This wrapper exists
 * so older call sites keep working, and now defaults to the shared thresholds
 * rather than a second hardcoded copy of them.
 */
import { tierFor, DEFAULT_TIER_THRESHOLDS, type Tier, type TierThresholds } from '@/lib/tiers'

export function calcLoyaltyTier(
  points: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS
): Tier {
  return tierFor(points, thresholds)
}

export function getTierEmoji(tier: string): string {
  return { gold: '🥇', silver: '🥈', bronze: '🥉', none: '' }[tier] ?? ''
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}
