'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Badge from '@/components/ui/Badge'

export type ReservationStatus =
  | 'pending' | 'confirmed' | 'seated' | 'completed'
  | 'cancelled' | 'declined' | 'no_show'

export interface ReservationView {
  id: string
  guest_name: string | null
  guest_phone: string | null
  requested_date: string
  requested_time: string | null
  party_size: number | null
  notes: string | null
  channel: string | null
  status: ReservationStatus
  created_at: string
}

const LABELS: Record<ReservationStatus, string> = {
  pending: 'Pending', confirmed: 'Confirmed', seated: 'Seated',
  completed: 'Completed', cancelled: 'Cancelled', declined: 'Declined',
  no_show: 'No-show',
}

const TONES: Record<ReservationStatus, 'default' | 'success' | 'warning' | 'danger' | 'teal'> = {
  pending: 'warning', confirmed: 'teal', seated: 'teal',
  completed: 'success', cancelled: 'default', declined: 'default',
  no_show: 'danger',
}

/**
 * Which moves make sense from here.
 *
 * A booking in the future cannot have been a no-show yet, and one already
 * closed out should not be re-opened by a stray click — so the actions offered
 * depend on both the status and whether the service has happened.
 */
function nextStates(status: ReservationStatus, isPast: boolean): ReservationStatus[] {
  switch (status) {
    case 'pending':   return isPast ? ['confirmed', 'no_show', 'declined'] : ['confirmed', 'declined']
    case 'confirmed': return isPast ? ['seated', 'no_show', 'cancelled'] : ['cancelled']
    case 'seated':    return ['completed', 'cancelled']
    default:          return []
  }
}

export default function ReservationRow({ r }: { r: ReservationView }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Compared by calendar day: a booking earlier today has already been served.
  const isPast = r.requested_date <= new Date().toISOString().slice(0, 10)
  const actions = nextStates(r.status, isPast)

  async function move(status: ReservationStatus) {
    setError('')
    const res = await fetch(`/api/reservations/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'Could not update')
      return
    }
    startTransition(() => router.refresh())
  }

  return (
    <div className="flex items-start gap-4 px-4 py-3 border-b border-line last:border-0">
      <div className="w-16 shrink-0">
        <div className="text-[13px] font-semibold text-ink tabular-nums">
          {r.requested_time?.slice(0, 5) ?? '—'}
        </div>
        <div className="text-[11px] text-mid tabular-nums">{r.requested_date.slice(5)}</div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[13px] font-medium text-ink truncate">
            {r.guest_name || 'Guest'}
          </span>
          <Badge variant={TONES[r.status]}>{LABELS[r.status]}</Badge>
          <span className="text-[12px] text-mid">
            {r.party_size ?? '?'} {r.party_size === 1 ? 'guest' : 'guests'}
          </span>
          {r.channel && <span className="text-[11px] text-mid">· {r.channel}</span>}
        </div>
        {r.notes && <p className="text-[12px] text-mid mt-0.5 truncate">{r.notes}</p>}
        {r.guest_phone && <p className="text-[11px] text-mid mt-0.5 tabular-nums">{r.guest_phone}</p>}
        {error && <p className="text-[11px] text-ember mt-1">{error}</p>}
      </div>

      {actions.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0">
          {actions.map(s => (
            <button
              key={s}
              onClick={() => move(s)}
              disabled={pending}
              className="px-2.5 py-1 rounded-md text-[12px] font-medium border border-line
                         text-mid hover:text-ink hover:border-ink/30 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
