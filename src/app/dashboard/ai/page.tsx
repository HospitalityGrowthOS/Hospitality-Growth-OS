export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'
import {
  FAQ_TOPICS,
  FAQ_TOPIC_LABELS,
  INTENT_LABELS,
  availableChannels,
  buildVenueContext,
  isAiConfigured,
  isIntent,
  missingFaqTopics,
  type Sentiment,
} from '@/lib/ai'
import ReviewDraftCard, { type ReviewDraftItem } from './ReviewDraftCard'

const SENTIMENT_VARIANT: Record<Sentiment, 'success' | 'default' | 'danger'> = {
  positive: 'success', neutral: 'default', negative: 'danger',
}

function fmtWhen(iso: string | null) {
  if (!iso) return '—'
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `${Math.max(mins, 0)}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default async function AiOverviewPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
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
    { count: pendingReservations },
  ] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, channel, created_at')
      .eq('venue_id', venueId)
      .limit(500),
    supabase
      .from('messages')
      .select('id, content, intent, sentiment, conversation_id')
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
      .select('id, rating, content, author_name, ai_response_draft, review_date')
      .eq('venue_id', venueId)
      .is('owner_response', null)
      .order('review_date', { ascending: false, nullsFirst: false })
      .limit(3),
    supabase
      .from('ai_interactions')
      .select('feature, success, latency_ms, error_message, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', since30)
      .limit(1000),
    supabase
      .from('reservation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venueId)
      .eq('status', 'pending'),
  ])

  const convs = conversations ?? []
  const msgs  = guestMessages ?? []
  const calls = interactions ?? []

  const escalatedConvs = convs.filter(c => c.status === 'escalated')
  const escalationRate = convs.length
    ? Math.round((escalatedConvs.length / convs.length) * 100)
    : 0

  // Intent and sentiment distribution over inbound messages.
  const intentCounts = new Map<string, number>()
  const sentimentCounts = new Map<string, number>()
  for (const m of msgs) {
    if (m.intent) intentCounts.set(m.intent, (intentCounts.get(m.intent) ?? 0) + 1)
    if (m.sentiment) sentimentCounts.set(m.sentiment, (sentimentCounts.get(m.sentiment) ?? 0) + 1)
  }
  const intentRows = Array.from(intentCounts.entries()).sort((a, b) => b[1] - a[1])
  const classified = intentRows.reduce((s, [, n]) => s + n, 0)

  // Questions the assistant couldn't place — the clearest signal of a gap.
  const unknownQuestions = msgs
    .filter(m => m.intent === 'unknown' || m.intent === 'general_question')
    .slice(0, 6)

  const failures = calls.filter(c => !c.success)
  const successRate = calls.length
    ? Math.round(((calls.length - failures.length) / calls.length) * 100)
    : null
  const latencies = calls.map(c => c.latency_ms).filter((n): n is number => typeof n === 'number')
  const avgLatency = latencies.length
    ? Math.round(latencies.reduce((s, n) => s + n, 0) / latencies.length)
    : null

  const missing = missingFaqTopics({
    id: venueId, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })
  const faqCoverage = Math.round(((FAQ_TOPICS.length - missing.length) / FAQ_TOPICS.length) * 100)

  const reviews: ReviewDraftItem[] = (reviewRows ?? []).map(r => ({
    id: r.id, rating: r.rating, content: r.content,
    authorName: r.author_name, draft: r.ai_response_draft, reviewDate: r.review_date,
  }))

  const context = buildVenueContext({
    id: venueId, name: venue.name, type: venue.type,
    city: venue.city, address: venue.address, settings: venue.settings,
  })

  const configured = isAiConfigured()

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-5">
      {!configured && (
        <Card className="border-l-2 border-l-ember">
          <CardBody className="py-3.5">
            <p className="text-[13px] font-medium text-ink">The assistant is not answering guests</p>
            <p className="text-xs text-mid mt-1 leading-relaxed">
              No API key is set, so messages are stored and handed to your team rather than
              answered. Add <code className="font-data text-[11px]">ANTHROPIC_API_KEY</code> to your
              environment variables and redeploy.
            </p>
          </CardBody>
        </Card>
      )}

      {/* Analytics */}
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Conversations" value={convs.length} />
        <KpiCard label="Escalation rate" value={`${escalationRate}%`} accent="ember" />
        <KpiCard label="Knowledge coverage" value={`${faqCoverage}%`} accent="gold" />
        <KpiCard
          label="Average response"
          value={avgLatency === null ? '—' : `${(avgLatency / 1000).toFixed(1)}s`}
          accent="teal"
        />
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* Intent distribution */}
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
                No classified messages yet. Try the{' '}
                <Link href="/dashboard/ai/console" className="text-teal hover:underline">Console</Link>.
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

        {/* Activity + sentiment */}
        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Assistant activity</h2>
            <p className="text-xs text-mid mt-0.5">Last 30 days · {context.assistantName}</p>
          </CardHeader>
          <CardBody className="space-y-3">
            <Stat label="AI requests" value={String(calls.length)} />
            <Stat label="Succeeded" value={successRate === null ? '—' : `${successRate}%`} />
            <Stat label="Failures" value={String(failures.length)} />
            <Stat label="Escalated conversations" value={String(escalatedConvs.length)} />
            <Stat label="Pending reservations" value={String(pendingReservations ?? 0)} />
            <div className="pt-1 flex items-center justify-between">
              <span className="text-[13px] text-mid">Sentiment</span>
              <div className="flex items-center gap-1.5">
                {(['positive', 'neutral', 'negative'] as Sentiment[]).map(s => (
                  <Badge key={s} variant={SENTIMENT_VARIANT[s]}>
                    {sentimentCounts.get(s) ?? 0}
                  </Badge>
                ))}
              </div>
            </div>
            <Stat label="Connected channels" value={availableChannels().join(', ') || 'none'} />
          </CardBody>
        </Card>
      </div>

      {/* Safety & quality */}
      <Card>
        <CardHeader>
          <h2 className="font-display text-[15px] font-semibold text-ink">Safety &amp; quality</h2>
          <p className="text-xs text-mid mt-0.5">
            Where the assistant is struggling, and what would fix it.
          </p>
        </CardHeader>
        <CardBody className="space-y-5">
          {/* Missing knowledge */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[13px] font-medium text-ink">Missing knowledge</p>
              <Link href="/dashboard/ai/knowledge" className="text-[12px] text-teal hover:underline">
                Fill these in
              </Link>
            </div>
            {missing.length === 0 ? (
              <p className="text-[12px] text-mid">Every topic has an answer.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  {missing.map(topic => (
                    <Badge key={topic} variant="warning">{FAQ_TOPIC_LABELS[topic]}</Badge>
                  ))}
                </div>
                <p className="text-[11px] text-mid/70 mt-2">
                  For these the assistant says it will check with your team rather than guessing.
                </p>
              </>
            )}
          </div>

          {/* Unknown questions */}
          <div>
            <p className="text-[13px] font-medium text-ink mb-2">Questions it couldn&rsquo;t place</p>
            {unknownQuestions.length === 0 ? (
              <p className="text-[12px] text-mid">Nothing unclassified in the last 30 days.</p>
            ) : (
              <div className="space-y-1.5">
                {unknownQuestions.map(m => (
                  <p key={m.id} className="text-[12px] text-mid bg-paper border border-border rounded-lg px-3 py-2">
                    &ldquo;{m.content.slice(0, 160)}&rdquo;
                  </p>
                ))}
              </div>
            )}
          </div>

          {/* Failures */}
          <div>
            <p className="text-[13px] font-medium text-ink mb-2">Recent failures</p>
            {failures.length === 0 ? (
              <p className="text-[12px] text-mid">No failed AI requests in the last 30 days.</p>
            ) : (
              <div className="space-y-1.5">
                {failures.slice(0, 4).map((f, i) => (
                  <div key={i} className="flex items-start justify-between gap-3 text-[12px] bg-paper border border-border rounded-lg px-3 py-2">
                    <span className="text-mid min-w-0">
                      <span className="font-data text-ink">{f.feature}</span>
                      {f.error_message ? ` — ${f.error_message.slice(0, 120)}` : ''}
                    </span>
                    <span className="text-mid/70 shrink-0">{fmtWhen(f.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

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
          <p className="text-xs text-mid mt-0.5">Drafts only — you edit and post them yourself.</p>
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
    </div>
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
