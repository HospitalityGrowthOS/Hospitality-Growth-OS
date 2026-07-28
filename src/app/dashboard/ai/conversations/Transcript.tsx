import Link from 'next/link'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { INTENT_LABELS, isIntent } from '@/lib/ai'

interface TranscriptMessage {
  role: string
  content: string
  intent: string | null
  sentiment: string | null
  sent_at: string | null
  created_at: string
}

/**
 * Replays a stored conversation exactly as it happened, with the signals the
 * assistant recorded at the time.
 */
export default function Transcript({
  conversationId,
  messages,
  backHref,
}: {
  conversationId: string
  messages: TranscriptMessage[]
  backHref: string
}) {
  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-[15px] font-semibold text-ink">Replay</h2>
          <p className="text-xs text-mid mt-0.5 font-data">{conversationId.slice(0, 8)}</p>
        </div>
        <Link href={backHref} className="text-[13px] text-teal hover:underline">
          Close
        </Link>
      </CardHeader>
      <CardBody className="space-y-3 max-h-[420px] overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-[13px] text-mid py-6 text-center">
            This conversation has no stored messages.
          </p>
        ) : (
          messages.map((m, i) => {
            const fromGuest = m.role === 'user'
            return (
              <div key={i} className={fromGuest ? 'flex justify-end' : 'flex justify-start'}>
                <div className={fromGuest ? 'max-w-[75%]' : 'max-w-[85%]'}>
                  <div
                    className={
                      fromGuest
                        ? 'bg-ember text-white rounded-2xl rounded-br-sm px-4 py-2.5'
                        : 'bg-paper border border-border rounded-2xl rounded-bl-sm px-4 py-2.5'
                    }
                  >
                    <p className={`text-[13px] leading-relaxed whitespace-pre-wrap ${fromGuest ? '' : 'text-ink'}`}>
                      {m.content}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    {m.intent && (
                      <Badge variant="teal">
                        {isIntent(m.intent) ? INTENT_LABELS[m.intent] : m.intent}
                      </Badge>
                    )}
                    {m.sentiment && (
                      <Badge variant={m.sentiment === 'negative' ? 'danger' : m.sentiment === 'positive' ? 'success' : 'default'}>
                        {m.sentiment}
                      </Badge>
                    )}
                    <span className="text-[10px] text-mid/70">
                      {new Date(m.sent_at ?? m.created_at).toLocaleString('en-GB', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </CardBody>
    </Card>
  )
}
