import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { HealthScore, Opportunity, Recommendation } from '@/lib/intelligence'

/** A labelled figure. Renders an em dash where the metric has no data. */
export function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: string | number | null
  note?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <span className="text-[13px] text-mid">{label}</span>
        {note && <p className="text-[11px] text-mid/70 mt-0.5">{note}</p>}
      </div>
      <span className="font-data text-[13px] font-semibold text-ink shrink-0">
        {value === null || value === '' ? '—' : value}
      </span>
    </div>
  )
}

/** Plain-language observations produced by the intelligence layer. */
export function Insights({ items }: { items: string[] }) {
  if (!items.length) {
    return (
      <p className="text-[13px] text-mid">
        Not enough activity here yet to draw a conclusion.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {items.map((text, i) => (
        <li key={i} className="flex gap-2.5 text-[13px] text-ink leading-relaxed">
          <span className="text-ember mt-[7px] w-1 h-1 rounded-full bg-ember shrink-0" />
          {text}
        </li>
      ))}
    </ul>
  )
}

const PRIORITY_VARIANT = { high: 'danger', medium: 'gold', low: 'default' } as const

export function RecommendationCard({ recommendation: r }: { recommendation: Recommendation }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-paper/50">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-[13px] font-medium text-ink">{r.title}</p>
        <div className="flex items-center gap-1.5 shrink-0">
          <Badge variant={PRIORITY_VARIANT[r.priority]}>{r.priority}</Badge>
          <Badge variant="default">{r.category}</Badge>
        </div>
      </div>
      <p className="text-xs text-mid leading-relaxed">{r.description}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5 pt-2.5 border-t border-border/60">
        {Object.entries(r.supportingMetrics).map(([key, value]) => (
          <span key={key} className="text-[11px] text-mid">
            {key.replace(/_/g, ' ')}: <span className="font-data text-ink">{String(value)}</span>
          </span>
        ))}
        <span className="text-[11px] text-mid/60 ml-auto">
          confidence {Math.round(r.confidence * 100)}%
        </span>
      </div>
    </div>
  )
}

export function OpportunityCard({ opportunity: o }: { opportunity: Opportunity }) {
  return (
    <div className="p-4 rounded-lg border border-border bg-paper/50">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <p className="text-[13px] font-medium text-ink">{o.title}</p>
        <Badge variant="teal">{o.audienceSize} {o.audienceSize === 1 ? 'guest' : 'guests'}</Badge>
      </div>
      <p className="text-xs text-mid leading-relaxed">{o.description}</p>
    </div>
  )
}

/** The health score with its component breakdown and the basis for each. */
export function HealthCard({ health }: { health: HealthScore }) {
  const tone =
    health.overall === null ? 'text-mid'
      : health.overall >= 70 ? 'text-success'
        : health.overall >= 45 ? 'text-gold'
          : 'text-ember'

  return (
    <Card>
      <CardHeader>
        <h2 className="font-display text-[15px] font-semibold text-ink">Business health</h2>
        <p className="text-xs text-mid mt-0.5">{health.verdict}</p>
      </CardHeader>
      <CardBody>
        <div className="flex items-start gap-6">
          <div className="shrink-0 text-center">
            <div className={`font-data text-5xl font-bold leading-none ${tone}`}>
              {health.overall ?? '—'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-mid mt-1.5">out of 100</div>
          </div>

          <div className="flex-1 space-y-3 min-w-0">
            {health.components.map(c => (
              <div key={c.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] text-ink">{c.label}</span>
                  <span className="font-data text-[12px] text-mid">
                    {c.score === null ? 'no data' : `${c.score} · ${Math.round(c.weight * 100)}%`}
                  </span>
                </div>
                <div className="h-1.5 bg-paper rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${c.score === null ? 'bg-border' : 'bg-ember'}`}
                    style={{ width: `${c.score ?? 0}%` }}
                  />
                </div>
                <p className="text-[11px] text-mid/70 mt-1">{c.basis}</p>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  )
}

/**
 * Placeholder for an integration that is not connected.
 *
 * Deliberately shows no numbers at all — a greyed-out fake figure reads as a
 * real one at a glance, which is exactly the thing this module must not do.
 */
export function IntegrationCard({
  title,
  description,
  requires,
}: {
  title: string
  description: string
  requires: string
}) {
  return (
    <div className="p-4 rounded-lg border border-dashed border-border bg-paper/30">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <p className="text-[13px] font-medium text-mid">{title}</p>
        <Badge variant="default">Not connected</Badge>
      </div>
      <p className="text-xs text-mid/80 leading-relaxed">{description}</p>
      <p className="text-[11px] text-mid/60 mt-2">Available once {requires} is connected.</p>
    </div>
  )
}

/** Consistent empty state across the module. */
export function Empty({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-display font-semibold text-ink mb-1">{title}</h3>
      <p className="text-[13px] text-mid max-w-sm leading-relaxed">{body}</p>
    </div>
  )
}
