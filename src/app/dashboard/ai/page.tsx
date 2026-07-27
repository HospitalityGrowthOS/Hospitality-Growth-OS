export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'
import {
  INTENT_LABELS,
  isIntent,
  isAiConfigured,
  buildVenueContext,
  missingFaqTopics,
  FAQ_TOPIC_LABELS,
  availableChannels,
  DEFAULT_MODEL,
} from '@/lib/ai'
import ReviewDraftCard, { type ReviewDraftItem } from './ReviewDraftCard'

function fmtWhen(iso: string | null) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function AiAssistantPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="AI Assistant" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { data: conversations },
    { data: guestMessages },
    { data: escalations },
    { data: reviewRows },
    { data: interactions },
    { data: reservations },
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, ai_handled, created_at, last_message_at, human_takeover_at, guest_id')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('messages')
      .select('id, role, intent, sentiment, created_at, conversation_id')
      .eq('venue_id', venueId)
      .eq('role', 'user')
      .gte('created_at', since30)
      .limit(500),
    supabase
      .from('action_items')
      .select('id, title, description, priority, created_at')
      .eq('venue_id', venueId)
      .eq('type', 'conversation_escalation')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
    supabase
      .from('reviews')
      .select('id, rating, content, author_name, ai_response_draft, review_date, owner_response')
      .eq('venue_id', venueId)
      .is('owner_response', null)
      .order('review_date', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('ai_interactions')
      .select('feature, success, latency_ms, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', since30)
      .limit(1000),
    supabase
      .from('reservation_requests')
      .select('id, guest_name, guest_phone, requested_date, requested_time, party_size, notes, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const convs = conversations ?? []
  const msgs  = guestMessages ?? []
  const calls = interactions ?? []

  const openCount      = convs.filter(c => c.status === 'open').length
  const escalatedCount = convs.filter(c => c.status === 'escalated').length

  // Intent mix over the last 30 days of inbound messages.
  const intentCounts = new Map<string, number>()
  for (const m of msgs) {
    if (m.intent && isIntent(m.intent)) {
      intentCounts.set(m.intent, (intentCounts.get(m.intent) ?? 0) + 1)
    }
  }
  const intentRows = Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1])
  const classified = intentRows.reduce((s, [, n]) => s + n, 0)

  const negativeCount = msgs.filter(m => m.sentiment === 'negative').length

  // A guest message is unanswered when its conversation has no later reply.
  const escalatedConvIds = new Set(convs.filter(c => c.status === 'escalated').map(c => c.id))
  const unanswered = msgs.filter(m => m.conversation_id && escalatedConvIds.has(m.conversation_id)).length

  const successfulCalls = calls.filter(c => c.success).length
  const successRate = calls.length ? Math.round((successfulCalls / calls.length) * 100) : null
  const latencies = calls.map(c => c.latency_ms).filter((n): n is number => typeof n === 'number')
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
    : null

  const reviews: ReviewDraftItem[] = (reviewRows ?? []).map(r => ({
    id: r.id,
    rating: r.rating,
    content: r.content,
    authorName: r.author_name,
    draft: r.ai_response_draft,
    reviewDate: r.review_date,
  }))

  const venueContext = buildVenueContext({
    id: venueId,
    name: venue.name,
    type: venue.type,
    city: venue.city,
    address: venue.address,
    settings: venue.settings,
  })
  const missingTopics = missingFaqTopics({
    id: venueId,
    name: venue.name,
    address: venue.address,
    city: venue.city,
    settings: venue.settings,
  })

  const configured = isAiConfigured()
  const channels = availableChannels()

  return (
    <>
      <Topbar
        title="AI Assistant"
        subtitle={`${venueContext.assistantName} answers guests on WhatsApp`}
        actions={
          <Badge variant={configured ? 'success' : 'warning'}>
            {configured ? 'Active' : 'Not configured'}
          </Badge>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {!configured && (
          <Card className="border-l-2 border-l-ember">
            <CardBody className="py-3.5">
              <p className="text-[13px] font-medium text-ink">The assistant is not answering guests</p>
              <p className="text-xs text-mid mt-1 leading-relaxed">
                No API key is set, so inbound messages are stored and handed to your team rather
                than answered. Add <code className="font-data text-[11px]">ANTHROPIC_API_KEY</code> to
                your environment variables and redeploy to switch it on.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Conversations" value={convs.length} />
          <KpiCard label="Open now" value={openCount} accent="teal" />
          <KpiCard label="Needs a human" value={escalatedCount} accent="ember" />
          <KpiCard
            label="Assistant reliability"
            value={successRate === null ? '—' : `${successRate}%`}
            accent="gold"
          />
        </div>

        {/* Escalations */}
        {escalations && escalations.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Waiting on you</h2>
              <p className="text-xs text-mid mt-0.5">
                Handed over because the assistant should not answer these alone.
              </p>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {escalations.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-paper border border-border">
                  <Badge variant={item.priority === 'high' ? 'danger' : 'warning'}>{item.priority}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{item.title}</p>
                    {item.description && (
                      <p className="text-xs text-mid mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <span className="text-[11px] text-mid shrink-0">{fmtWhen(item.created_at)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        {/* Review drafts */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Review replies</h2>
            <p className="text-xs text-mid mt-0.5">
              Drafts only — you edit and post them yourself.
            </p>
          </CardHeader>
          <CardBody className={reviews.length ? 'space-y-3' : 'p-0'}>
            {reviews.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">⭐</div>
                <h3 className="font-display font-semibold text-ink mb-1">No reviews awaiting a reply</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  When a review comes in, a draft response can be generated here.
                </p>
              </div>
            ) : (
              reviews.map(r => <ReviewDraftCard key={r.id} review={r} />)
            )}
          </CardBody>
        </Card>

        <div className="grid grid-cols-2 gap-5">
          {/* Intent mix */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">What guests ask about</h2>
              <p className="text-xs text-mid mt-0.5">
                {classified ? `${classified} messages, last 30 days` : 'Last 30 days'}
              </p>
            </CardHeader>
            <CardBody className={intentRows.length ? 'space-y-2' : ''}>
              {intentRows.length === 0 ? (
                <p className="text-[13px] text-mid py-6 text-center">
                  No classified messages yet.
                </p>
              ) : (
                intentRows.map(([intent, count]) => {
                  const label = isIntent(intent) ? INTENT_LABELS[intent] : intent
                  const share = classified ? Math.round((count / classified) * 100) : 0
                  return (
                    <div key={intent} className="flex items-center gap-3">
                      <span className="text-[13px] text-ink w-36 shrink-0">{label}</span>
                      <div className="flex-1 h-1.5 bg-paper rounded-full overflow-hidden">
                        <div className="h-full bg-ember rounded-full" style={{ width: `${share}%` }} />
                      </div>
                      <span className="font-data text-[12px] text-mid w-10 text-right">{count}</span>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>

          {/* Activity */}
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Assistant activity</h2>
              <p className="text-xs text-mid mt-0.5">Last 30 days · {DEFAULT_MODEL}</p>
            </CardHeader>
            <CardBody className="space-y-3">
              <Stat label="AI requests" value={String(calls.length)} />
              <Stat label="Succeeded" value={successRate === null ? '—' : `${successfulCalls} (${successRate}%)`} />
              <Stat label="Average response time" value={avgLatency === null ? '—' : `${(avgLatency / 1000).toFixed(1)}s`} />
              <Stat label="Unhappy messages" value={String(negativeCount)} />
              <Stat label="Unanswered" value={String(unanswered)} />
              <Stat label="Connected channels" value={channels.join(', ') || 'none'} />
            </CardBody>
          </Card>
        </div>

        {/* Reservation requests */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Reservation requests</h2>
            <p className="text-xs text-mid mt-0.5">
              Captured from conversations. Nothing is booked — confirm these with the guest yourself.
            </p>
          </CardHeader>
          <CardBody className={reservations && reservations.length ? 'space-y-2' : 'p-0'}>
            {!reservations || reservations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">📅</div>
                <h3 className="font-display font-semibold text-ink mb-1">No pending requests</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  When a guest asks for a table, the details appear here as a pending request.
                </p>
              </div>
            ) : (
              reservations.map(r => (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-paper border border-border">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">
                      {r.guest_name || r.guest_phone || 'Guest'}
                      {r.party_size ? ` · ${r.party_size} people` : ''}
                    </p>
                    <p className="text-xs text-mid mt-0.5">
                      {r.requested_date ?? 'No date given'}
                      {r.requested_time ? ` at ${r.requested_time}` : ''}
                      {r.notes ? ` · ${r.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="warning">Pending</Badge>
                    <span className="text-[11px] text-mid">{fmtWhen(r.created_at)}</span>
                  </div>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        {/* Knowledge gaps */}
        {missingTopics.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Fill in what the assistant doesn&rsquo;t know</h2>
              <p className="text-xs text-mid mt-0.5">
                For these topics it says it will check with the team, rather than guessing.
              </p>
            </CardHeader>
            <CardBody>
              <div className="flex flex-wrap gap-2">
                {missingTopics.map(topic => (
                  <Badge key={topic} variant="default">{FAQ_TOPIC_LABELS[topic]}</Badge>
                ))}
              </div>
              <Link href="/dashboard/settings" className="text-[13px] text-teal hover:underline inline-block mt-3">
                Add these in settings
              </Link>
            </CardBody>
          </Card>
        )}

        {/* Conversations */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Recent conversations</h2>
          </CardHeader>
          <CardBody className="p-0">
            {convs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="text-4xl mb-3">💬</div>
                <h3 className="font-display font-semibold text-ink mb-1">No conversations yet</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  When a guest messages your WhatsApp number, the thread appears here.
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                    <th className="px-5 py-2.5 font-semibold">Guest</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold">Handled by</th>
                    <th className="px-5 py-2.5 font-semibold">Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {convs.map(c => (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3">
                        {c.guest_id ? (
                          <Link href={`/dashboard/guests/${c.guest_id}`} className="text-ink hover:text-teal">
                            View guest
                          </Link>
                        ) : (
                          <span className="text-mid">Unknown</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            c.status === 'escalated' ? 'danger'
                              : c.status === 'open' ? 'teal'
                                : 'default'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-mid">
                        {c.human_takeover_at ? 'Your team' : c.ai_handled ? venueContext.assistantName : '—'}
                      </td>
                      <td className="px-5 py-3 text-mid">{fmtWhen(c.last_message_at ?? c.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-mid">{label}</span>
      <span className="font-data text-[13px] font-semibold text-ink">{value}</span>
    </div>
  )
}
