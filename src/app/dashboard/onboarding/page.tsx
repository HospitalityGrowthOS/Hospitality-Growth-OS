export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

type Step = {
  title: string
  desc: string
  done: boolean
  required: boolean
  cta: string
  href: string
}

export default async function OnboardingPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Onboarding" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const supabase = await createAdminClient()
  const venueId = venue.id

  const [{ count: memberCount }, { count: guestCount }, { count: visitCount }] = await Promise.all([
    supabase.from('loyalty_members').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
    supabase.from('visits').select('id', { count: 'exact', head: true }).eq('venue_id', venueId),
  ])

  const settings = (venue.settings || {}) as Record<string, unknown>

  const steps: Step[] = [
    {
      title: 'Connect your WhatsApp Business number',
      desc: 'Messages to guests send from this number. Without it, nothing goes out.',
      done: Boolean(venue.whatsapp_phone_number_id && venue.whatsapp_access_token),
      required: true,
      cta: 'View WhatsApp',
      href: '/dashboard/whatsapp',
    },
    {
      title: 'Add your Google review link',
      desc: 'Google Maps → your venue → Share → copy link. Guests who rate you 4–5 stars are sent here; without it they only see a thank-you and your rating never moves.',
      done: Boolean(settings.google_review_url),
      required: true,
      cta: settings.google_review_url ? 'Edit link' : 'Add link',
      href: '/dashboard/settings',
    },
    {
      title: 'Set your loyalty rules',
      desc: 'Points per euro, tier thresholds and how long to wait before asking for a review.',
      done: settings.points_per_euro != null,
      required: true,
      cta: 'Open settings',
      href: '/dashboard/settings',
    },
    {
      title: 'Put your QR code on the tables',
      desc: 'Guests scan and enrol in about 20 seconds — no app needed.',
      done: (memberCount ?? 0) > 0,
      required: true,
      cta: (memberCount ?? 0) > 0 ? 'View QR code' : 'Get QR code',
      href: '/dashboard/loyalty/qr-code',
    },
    {
      title: 'Record your first visit',
      desc: 'Recording a visit starts the review clock — the request goes out automatically once the delay passes.',
      done: (visitCount ?? 0) > 0,
      required: true,
      cta: 'View reviews',
      href: '/dashboard/reviews',
    },
    {
      title: 'Import your existing guests',
      desc: 'Bring across guests you already have so campaigns and loyalty start with an audience.',
      done: (guestCount ?? 0) > 0,
      required: false,
      cta: 'Open Guest CRM',
      href: '/dashboard/guests',
    },
    {
      title: 'Switch on the AI assistant',
      desc: 'Answers guest questions on WhatsApp around the clock, in any language.',
      done: Boolean(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
      required: false,
      cta: 'Set up assistant',
      href: '/dashboard/ai',
    },
  ]

  const requiredSteps = steps.filter(s => s.required)
  const requiredDone  = requiredSteps.filter(s => s.done).length
  const pct = Math.round((requiredDone / requiredSteps.length) * 100)
  const liveReady = requiredDone === requiredSteps.length

  return (
    <>
      <Topbar
        title="Onboarding"
        subtitle="Get this venue fully set up"
        actions={
          <Badge variant={liveReady ? 'success' : 'warning'}>
            {requiredDone}/{requiredSteps.length} required complete
          </Badge>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        <Card className="mb-6">
          <CardBody>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {liveReady ? 'This venue is ready to go live' : 'Setup progress'}
                </p>
                <p className="text-xs text-mid mt-0.5">
                  {liveReady
                    ? 'Every required step is done. Loyalty and review automation are running.'
                    : `${requiredSteps.length - requiredDone} required ${requiredSteps.length - requiredDone === 1 ? 'step' : 'steps'} left before guests are reached.`}
                </p>
              </div>
              <span className="font-data text-2xl font-bold text-ink">{pct}%</span>
            </div>
            <div className="h-1.5 bg-paper rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${liveReady ? 'bg-success' : 'bg-ember'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-display text-[15px] font-semibold text-ink">Setup steps</h2>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {steps.map(step => (
              <div
                key={step.title}
                className={`flex items-start gap-3.5 p-3.5 rounded-lg border ${
                  step.done ? 'bg-paper/60 border-border' : 'bg-white border-border'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full shrink-0 mt-0.5 flex items-center justify-center ${
                    step.done ? 'bg-success' : 'border-2 border-border'
                  }`}
                >
                  {step.done && (
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12" />
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`text-[13px] font-medium ${step.done ? 'text-mid' : 'text-ink'}`}>
                      {step.title}
                    </p>
                    {!step.required && <Badge variant="default">Optional</Badge>}
                  </div>
                  <p className="text-xs text-mid mt-1 leading-relaxed">{step.desc}</p>
                </div>

                <Link href={step.href} className="shrink-0">
                  <Button size="sm" variant={step.done ? 'ghost' : 'secondary'}>
                    {step.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
