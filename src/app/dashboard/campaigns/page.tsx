export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import KpiCard from '@/components/ui/KpiCard'

type Campaign = {
  id: string
  name: string
  type: string | null
  status: string
  audience_count: number | null
  sent_count: number | null
  delivered_count: number | null
  clicked_count: number | null
  scheduled_at: string | null
  created_at: string
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'teal' | 'default'> = {
  completed: 'success',
  sending:   'teal',
  scheduled: 'warning',
  draft:     'default',
  failed:    'danger',
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function CampaignsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Campaigns" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()

  const [{ data: campaignRows }, { count: guestCount }] = await Promise.all([
    supabase
      .from('campaigns')
      .select('id, name, type, status, audience_count, sent_count, delivered_count, clicked_count, scheduled_at, created_at')
      .eq('venue_id', venue.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('guests')
      .select('id', { count: 'exact', head: true })
      .eq('venue_id', venue.id)
      .eq('whatsapp_opted_in', true),
  ])

  const campaigns = (campaignRows ?? []) as Campaign[]
  const totalSent      = campaigns.reduce((n, c) => n + (c.sent_count ?? 0), 0)
  const totalDelivered = campaigns.reduce((n, c) => n + (c.delivered_count ?? 0), 0)
  const totalClicked   = campaigns.reduce((n, c) => n + (c.clicked_count ?? 0), 0)
  const clickRate = totalDelivered ? Math.round((totalClicked / totalDelivered) * 100) : 0

  return (
    <>
      <Topbar title="Campaigns" subtitle="WhatsApp broadcasts to your guest list" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="Reachable guests" value={guestCount ?? 0} accent="teal" />
          <KpiCard label="Messages sent" value={totalSent} />
          <KpiCard label="Delivered" value={totalDelivered} accent="teal" />
          <KpiCard label="Click rate" value={`${clickRate}%`} accent="gold" />
        </div>

        <Card className="border-l-2 border-l-gold">
          <CardBody className="py-3.5">
            <p className="text-[13px] font-medium text-ink">Campaigns need an approved WhatsApp template</p>
            <p className="text-xs text-mid mt-1 leading-relaxed">
              WhatsApp only allows free-form messages within 24&nbsp;hours of a guest writing to you.
              Anything else — including promotions — must use a marketing template approved by Meta
              first. Create one in the WhatsApp Manager, then reference it on the campaign.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-[15px] font-semibold text-ink">All campaigns</h2>
              <p className="text-xs text-mid mt-0.5">{campaigns.length} total</p>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {campaigns.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="text-4xl mb-3">📣</div>
                <h3 className="font-display font-semibold text-ink mb-1">No campaigns yet</h3>
                <p className="text-[13px] text-mid max-w-sm leading-relaxed">
                  Once you have an approved marketing template, campaigns you send will appear here
                  with delivery and click performance.
                </p>
                <Link href="/dashboard/guests" className="text-[13px] text-teal hover:underline mt-4">
                  View your guest list
                </Link>
              </div>
            ) : (
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-mid border-b border-border">
                    <th className="px-5 py-2.5 font-semibold">Campaign</th>
                    <th className="px-5 py-2.5 font-semibold">Status</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Audience</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Sent</th>
                    <th className="px-5 py-2.5 font-semibold text-right">Clicks</th>
                    <th className="px-5 py-2.5 font-semibold">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map(c => (
                    <tr key={c.id} className="border-b border-border/60 last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium text-ink">{c.name}</div>
                        {c.type && <div className="text-xs text-mid mt-0.5 capitalize">{c.type.replace(/_/g, ' ')}</div>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={STATUS_VARIANT[c.status] ?? 'default'}>{c.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right font-data text-mid">{c.audience_count ?? 0}</td>
                      <td className="px-5 py-3 text-right font-data text-mid">{c.sent_count ?? 0}</td>
                      <td className="px-5 py-3 text-right font-data text-mid">{c.clicked_count ?? 0}</td>
                      <td className="px-5 py-3 text-mid">{fmtDate(c.scheduled_at ?? c.created_at)}</td>
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
