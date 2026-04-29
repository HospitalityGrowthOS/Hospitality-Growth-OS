export const dynamic = 'force-dynamic'
/**
 * /dashboard/whatsapp — WhatsApp message activity log.
 * Shows recent outbound messages sent via Twilio.
 */
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'

type WAMessage = {
  id: string
  phone: string
  message_type: string
  body: string
  status: string
  twilio_sid: string | null
  error_message: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = {
  loyalty_welcome: 'Loyalty Welcome',
  review_request:  'Review Request',
  campaign:        'Campaign',
  manual:          'Manual',
}

const TYPE_ICON: Record<string, string> = {
  loyalty_welcome: '🎉',
  review_request:  '⭐',
  campaign:        '📣',
  manual:          '💬',
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent:      'bg-blue-50 text-blue-700 border-blue-200',
    delivered: 'bg-[#2A9D5C]/10 text-[#2A9D5C] border-[#2A9D5C]/20',
    read:      'bg-[#1A7A9A]/10 text-[#1A7A9A] border-[#1A7A9A]/20',
    failed:    'bg-[#C0392B]/10 text-[#C0392B] border-[#C0392B]/20',
  }
  const labels: Record<string, string> = {
    sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed',
  }
  const cls = styles[status] ?? styles.sent
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {labels[status] ?? status}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-4">💬</div>
      <h3 className="font-display font-semibold text-ink text-lg mb-2">No messages yet</h3>
      <p className="text-[13px] text-mid max-w-xs leading-relaxed">
        WhatsApp messages will appear here once guests sign up for loyalty or receive review requests.
      </p>
      <div className="mt-6 bg-[#F5F0E8] border border-[#E8E0D4] rounded-xl p-4 max-w-sm text-left">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#6B5F56] mb-2">Twilio Sandbox Setup</div>
        <ol className="text-[12px] text-[#2C2520] space-y-1.5 list-decimal list-inside">
          <li>Go to <span className="font-mono text-[#E85D26]">twilio.com/console</span></li>
          <li>Messaging → Try it out → Send a WhatsApp message</li>
          <li>Add <span className="font-mono text-[#E85D26]">TWILIO_ACCOUNT_SID</span> + <span className="font-mono text-[#E85D26]">TWILIO_AUTH_TOKEN</span> to <span className="font-mono">.env.local</span></li>
          <li>Guest sends <span className="font-semibold">join &lt;keyword&gt;</span> to sandbox number</li>
          <li>Send a test signup → message appears here</li>
        </ol>
      </div>
    </div>
  )
}

export default async function WhatsAppPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="WhatsApp" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center"><EmptyState /></div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId  = venue.id

  const [
    { data: messages },
    { count: totalSent },
    { count: totalDelivered },
    { count: totalFailed },
  ] = await Promise.all([
    supabase
      .from('whatsapp_messages')
      .select('*')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).in('status', ['delivered', 'read']),
    supabase.from('whatsapp_messages').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).eq('status', 'failed'),
  ])

  const msgs       = (messages ?? []) as WAMessage[]
  const deliveryRate = (totalSent ?? 0) > 0
    ? Math.round(((totalDelivered ?? 0) / (totalSent ?? 1)) * 100)
    : 0

  const loyaltyCount = msgs.filter(m => m.message_type === 'loyalty_welcome').length
  const reviewCount  = msgs.filter(m => m.message_type === 'review_request').length

  return (
    <>
      <Topbar
        title="WhatsApp"
        subtitle="Outbound message activity log"
      />

      <div className="flex-1 overflow-y-auto p-7 space-y-7">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Sent',     value: String(totalSent ?? 0),      sub: 'All time',          color: 'border-t-ember' },
            { label: 'Delivered',      value: `${deliveryRate}%`,           sub: `${totalDelivered ?? 0} confirmed`, color: 'border-t-[#2A9D5C]' },
            { label: 'Failed',         value: String(totalFailed ?? 0),     sub: totalFailed ? 'Check logs below' : 'All good ✓', color: 'border-t-[#C0392B]' },
            { label: 'Loyalty / Review', value: `${loyaltyCount} / ${reviewCount}`, sub: 'Message types', color: 'border-t-teal' },
          ].map(({ label, value, sub, color }) => (
            <div key={label} className={`bg-white border border-[#E8E0D4] border-t-2 ${color} rounded-xl p-5`}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mid mb-2">{label}</div>
              <div className="font-data text-3xl font-bold text-ink leading-none">{value}</div>
              <div className="text-[11px] text-mid mt-2">{sub}</div>
            </div>
          ))}
        </div>

        {/* Setup banner — shown when Twilio not configured */}
        {!process.env.TWILIO_ACCOUNT_SID && (
          <div className="bg-[#C8A45A]/10 border border-[#C8A45A]/30 rounded-xl p-4 flex items-start gap-3">
            <span className="text-xl flex-shrink-0">⚠️</span>
            <div>
              <div className="text-[13px] font-semibold text-ink mb-0.5">Twilio not connected</div>
              <p className="text-[12px] text-mid leading-relaxed">
                Messages are being stubbed to the console. Add <code className="bg-[#F5F0E8] px-1 rounded text-[11px]">TWILIO_ACCOUNT_SID</code> and <code className="bg-[#F5F0E8] px-1 rounded text-[11px]">TWILIO_AUTH_TOKEN</code> to <code className="bg-[#F5F0E8] px-1 rounded text-[11px]">.env.local</code> to send real messages.
              </p>
            </div>
          </div>
        )}

        {/* Message log */}
        <section>
          <div className="mb-4">
            <h2 className="font-display font-semibold text-ink text-lg">Recent Messages</h2>
            <p className="text-[12px] text-mid">Last 50 outbound WhatsApp messages</p>
          </div>

          {msgs.length === 0 ? (
            <Card><EmptyState /></Card>
          ) : (
            <Card>
              {/* Table header */}
              <div className="grid grid-cols-[40px_1fr_140px_130px_100px_120px] gap-3 px-4 py-2.5 border-b border-[#E8E0D4] bg-paper/60 rounded-t-xl">
                {['', 'Phone', 'Type', 'Preview', 'Status', 'Sent'].map((h, i) => (
                  <div key={i} className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mid">{h}</div>
                ))}
              </div>

              {msgs.map((msg, i) => (
                <div
                  key={msg.id}
                  className={`grid grid-cols-[40px_1fr_140px_130px_100px_120px] gap-3 px-4 py-3 items-center ${
                    i < msgs.length - 1 ? 'border-b border-[#E8E0D4]' : ''
                  } hover:bg-paper/40 transition-colors`}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-[#E85D26]/10 flex items-center justify-center text-base flex-shrink-0">
                    {TYPE_ICON[msg.message_type] ?? '💬'}
                  </div>

                  {/* Phone */}
                  <span className="text-[12px] font-data text-ink">{msg.phone}</span>

                  {/* Type */}
                  <span className="text-[12px] text-mid">{TYPE_LABEL[msg.message_type] ?? msg.message_type}</span>

                  {/* Body preview */}
                  <span className="text-[11px] text-mid truncate" title={msg.body}>
                    {msg.body.slice(0, 45)}{msg.body.length > 45 ? '…' : ''}
                  </span>

                  {/* Status */}
                  <div>
                    <StatusBadge status={msg.status} />
                    {msg.error_message && (
                      <div className="text-[10px] text-[#C0392B] mt-0.5 truncate" title={msg.error_message}>
                        {msg.error_message.slice(0, 30)}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <span className="text-[11px] text-mid">
                    {new Date(msg.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric', month: 'short',
                    })}{' '}
                    {new Date(msg.created_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </section>

      </div>
    </>
  )
}
