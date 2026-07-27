export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card, CardBody } from '@/components/ui/Card'
import SettingsForm, { type VenueSettingsValues } from './SettingsForm'

export default async function SettingsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Settings" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
        </div>
      </>
    )
  }

  const settings = (venue.settings || {}) as Record<string, unknown>

  const initial: VenueSettingsValues = {
    name:                 venue.name || '',
    city:                 venue.city || '',
    address:              venue.address || '',
    google_review_url:    (settings.google_review_url as string) || '',
    ai_persona_name:      (settings.ai_persona_name as string) || 'Sofia',
    review_delay_minutes: (settings.review_delay_minutes as number) ?? 45,
    points_per_euro:      (settings.points_per_euro as number) ?? 10,
  }

  const whatsappConnected = Boolean(venue.whatsapp_phone_number_id && venue.whatsapp_access_token)

  return (
    <>
      <Topbar title="Settings" subtitle="Venue configuration" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {!initial.google_review_url && (
          <Card className="max-w-2xl border-l-2 border-l-gold">
            <CardBody className="py-3.5">
              <p className="text-[13px] text-ink font-medium">Add your Google review link</p>
              <p className="text-xs text-mid mt-1 leading-relaxed">
                Until it&rsquo;s set, guests who rate you 4–5 stars see a thank-you message instead of
                being sent to Google — so the review automation can&rsquo;t lift your rating.
              </p>
            </CardBody>
          </Card>
        )}

        <SettingsForm initial={initial} />

        <Card className="max-w-2xl">
          <CardBody className="flex items-center justify-between py-4">
            <div>
              <p className="text-[13px] font-medium text-ink">WhatsApp</p>
              <p className="text-xs text-mid mt-0.5">
                {whatsappConnected
                  ? 'Connected — messages send from your business number.'
                  : 'Not connected. Loyalty and review messages will not send.'}
              </p>
            </div>
            <Link href="/dashboard/whatsapp" className="text-[13px] text-teal hover:underline shrink-0">
              View activity
            </Link>
          </CardBody>
        </Card>

        <Card className="max-w-2xl">
          <CardBody className="flex items-center justify-between py-4">
            <div>
              <p className="text-[13px] font-medium text-ink">Billing</p>
              <p className="text-xs text-mid mt-0.5">Manage your plan, invoices and payment method.</p>
            </div>
            <Link href="/dashboard/settings/billing" className="text-[13px] text-teal hover:underline shrink-0">
              Open billing
            </Link>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
