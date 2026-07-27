export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'

type Conversation = {
  id: string
  status: string
  ai_handled: boolean | null
  created_at: string
  human_takeover_at: string | null
  guest_id: string | null
}

function fmtWhen(iso: string) {
  const d = new Date(iso)
  const mins = Math.floor((Date.now() - d.getTime()) / 60000)
  if (mins < 60) return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
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

  const [{ data: convRows }, { count: messageCount }, { data: escalations }] = await Promise.all([
    supabase
      .from('conversations')
      .select('id, status, ai_handled, created_at, human_takeover_at, guest_id')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .limit(25),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venue.id),
    supabase
      .from('action_items')
      .select('id, title, description, priority, created_at')
      .eq('venue_id', venue.id)
      .eq('type', 'conversation_escalation')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  const conversations = (convRows ?? []) as Conversation[]
  const openCount      = conversations.filter(c => c.status === 'open').length
  const escalatedCount = conversations.filter(c => c.status === 'escalated').length
  const aiHandled      = conversations.filter(c => c.ai_handled).length
  const autoRate = conversations.length
    ? Math.round((aiHandled / conversations.length) * 100)
    : 0

  const settings = (venue.settings || {}) as Record<string, unknown>
  const personaName = (settings.ai_persona_name as string) || 'Sofia'
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY)

  return (
    <>
      <Topbar title="AI Assistant" subtitle={`${personaName} answers guests on WhatsApp`} />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {!aiConfigured && (
          <Card className="border-l-2 border-l-ember">
            <CardBody className="py-3.5">
              <p className="text-[13px] font-medium text-ink">Assistant is not active</p>
              <p className="text-xs text-mid mt-1 leading-relaxed">
                No Claude API key is configured, so incoming guest messages are received and stored
                but never answered. Add <code className="font-data text-[11px]">ANTHROPIC_API_KEY</code>{' '}
                to your environment variables and redeploy to switch it on.
              </p>
            </CardBody>
          </Card>
        )}

        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Conversations" value={conversations.length} />
          <KpiCard label="Open now" value={openCount} accent="teal" />
          <KpiCard label="Handled by AI" value={`${autoRate}%`} accent="gold" />
          <KpiCard label="Needs a human" value={escalatedCount} accent="ember" />
        </div>

        {escalations && escalations.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-display text-[15px] font-semibold text-ink">Waiting on you</h2>
              <p className="text-xs text-mid mt-0.5">
                The assistant handed these over because it couldn&rsquo;t resolve them.
              </p>
            </CardHeader>
            <CardBody className="space-y-2.5">
              {escalations.map(item => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg bg-paper border border-border">
                  <Badge variant={item.priority === 'high' ? 'danger' : 'warning'}>{item.priority}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-ink">{item.title}</p>
                    <p className="text-xs text-mid mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                  <span className="text-[11px] text-mid shrink-0">{fmtWhen(item.created_at)}</span>
                </div>
              ))}
            </CardBody>
          </Card>
        )}

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">Recent conversations</h2>
              <p className="text-xs text-mid mt-0.5">{messageCount ?? 0} messages exchanged in total</p>
            </div>
            <Link href="/dashboard/settings" className="text-[13px] text-teal hover:underline">
              Configure {personaName}
            </Link>
          </CardHeader>
          <CardBody className="p-0">
            {conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="text-4xl mb-3">💬</div>
                <h3 className="font-display font-semibold text-ink mb-1">No conversations yet</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  When a guest messages your WhatsApp business number, the conversation appears here —
                  along with how the assistant replied.
                </p>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                    <th className="px-5 py-2.5 font-semibold">Conversation</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold">Handled by</th>
                    <th className="px-5 py-2.5 font-semibold">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {conversations.map(c => (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3 font-data text-xs text-mid">{c.id.slice(0, 8)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={c.status === 'escalated' ? 'danger' : c.status === 'open' ? 'teal' : 'default'}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-mid">
                        {c.human_takeover_at ? 'Handed to staff' : c.ai_handled ? personaName : '—'}
                      </td>
                      <td className="px-5 py-3 text-mid">{fmtWhen(c.created_at)}</td>
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
