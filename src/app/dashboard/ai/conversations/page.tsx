export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { Card, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { INTENTS, INTENT_LABELS, SENTIMENTS, isIntent, type Intent, type Sentiment } from '@/lib/ai'
import ConversationFilters from './ConversationFilters'
import Transcript from './Transcript'

const CHANNELS = ['whatsapp', 'web', 'email', 'voice'] as const

interface SearchParams {
  channel?: string
  intent?: string
  sentiment?: string
  status?: string
  q?: string
  open?: string
}

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

export default async function ConversationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
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

  // Message-level filters (intent, sentiment, text) select conversations by
  // finding matching messages first, then loading those threads.
  const wantsMessageFilter = Boolean(searchParams.intent || searchParams.sentiment || searchParams.q)
  let conversationIdFilter: string[] | null = null

  if (wantsMessageFilter) {
    let msgQuery = supabase
      .from('messages')
      .select('conversation_id')
      .eq('venue_id', venueId)
      .limit(500)

    if (searchParams.intent && isIntent(searchParams.intent)) {
      msgQuery = msgQuery.eq('intent', searchParams.intent)
    }
    if (searchParams.sentiment) {
      msgQuery = msgQuery.eq('sentiment', searchParams.sentiment)
    }
    if (searchParams.q) {
      msgQuery = msgQuery.ilike('content', `%${searchParams.q}%`)
    }

    const { data: matches } = await msgQuery
    conversationIdFilter = Array.from(
      new Set((matches ?? []).map(m => m.conversation_id).filter(Boolean))
    ) as string[]
  }

  let query = supabase
    .from('conversations')
    .select('id, channel, status, ai_handled, guest_id, created_at, last_message_at, message_count')
    .eq('venue_id', venueId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (searchParams.channel) query = query.eq('channel', searchParams.channel)
  if (searchParams.status === 'escalated') query = query.eq('status', 'escalated')
  if (searchParams.status === 'open') query = query.eq('status', 'open')
  if (conversationIdFilter) {
    // No matching messages means no matching threads — short-circuit with an
    // impossible id rather than returning everything.
    query = query.in('id', conversationIdFilter.length ? conversationIdFilter : ['00000000-0000-0000-0000-000000000000'])
  }

  const { data: convRows } = await query
  const conversations = convRows ?? []

  // Guest names in one batched lookup.
  const guestIds = Array.from(new Set(conversations.map(c => c.guest_id).filter(Boolean))) as string[]
  const { data: guestRows } = guestIds.length
    ? await supabase.from('guests').select('id, name, phone').in('id', guestIds)
    : { data: [] as { id: string; name: string | null; phone: string | null }[] }
  const guestsById = new Map((guestRows ?? []).map(g => [g.id, g]))

  // Replay: load the full transcript for the opened thread.
  const openId = searchParams.open ?? null
  let transcript: { role: string; content: string; intent: string | null; sentiment: string | null; sent_at: string | null; created_at: string }[] = []
  if (openId) {
    const { data } = await supabase
      .from('messages')
      .select('role, content, intent, sentiment, sent_at, created_at')
      .eq('conversation_id', openId)
      .eq('venue_id', venueId)
      .order('created_at', { ascending: true })
      .limit(100)
    transcript = data ?? []
  }

  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) if (v && k !== 'open') params.set(k, v)

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-4">
      <ConversationFilters
        channels={[...CHANNELS]}
        intents={[...INTENTS]}
        intentLabels={INTENT_LABELS}
        sentiments={[...SENTIMENTS]}
        current={{
          channel: searchParams.channel ?? '',
          intent: searchParams.intent ?? '',
          sentiment: searchParams.sentiment ?? '',
          status: searchParams.status ?? '',
          q: searchParams.q ?? '',
        }}
      />

      {openId && (
        <Transcript
          conversationId={openId}
          messages={transcript}
          backHref={`/dashboard/ai/conversations${params.toString() ? `?${params}` : ''}`}
        />
      )}

      <Card>
        <CardBody className="p-0">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <div className="text-4xl mb-3">🗂️</div>
              <h3 className="font-display font-semibold text-ink mb-1">No conversations found</h3>
              <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                {wantsMessageFilter || searchParams.channel || searchParams.status
                  ? 'Nothing matches these filters. Try clearing them.'
                  : 'Conversations from WhatsApp and the Console appear here.'}
              </p>
            </div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Guest</th>
                  <th className="px-5 py-2.5 font-semibold">Channel</th>
                  <th className="px-5 py-2.5 font-semibold">Status</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Messages</th>
                  <th className="px-5 py-2.5 font-semibold">Last activity</th>
                  <th className="px-5 py-2.5 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {conversations.map(c => {
                  const guest = c.guest_id ? guestsById.get(c.guest_id) : undefined
                  const replayParams = new URLSearchParams(params)
                  replayParams.set('open', c.id)
                  return (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3">
                        {c.guest_id ? (
                          <Link href={`/dashboard/guests/${c.guest_id}`} className="text-ink hover:text-teal">
                            {guest?.name || guest?.phone || 'Unknown guest'}
                          </Link>
                        ) : (
                          <span className="text-mid">Console tester</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={c.channel === 'web' ? 'default' : 'teal'}>{c.channel}</Badge>
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
                      <td className="px-5 py-3 text-right font-data text-mid">{c.message_count ?? 0}</td>
                      <td className="px-5 py-3 text-mid">{fmtWhen(c.last_message_at ?? c.created_at)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link
                          href={`/dashboard/ai/conversations?${replayParams}`}
                          className="text-[12px] text-teal hover:underline"
                        >
                          Replay
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  )
}
