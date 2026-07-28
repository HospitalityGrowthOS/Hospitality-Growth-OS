export const dynamic = 'force-dynamic'

import { getCurrentVenue } from '@/lib/venue'
import {
  DEFAULT_MODEL,
  REPLY_LENGTHS,
  REPLY_LENGTH_LABELS,
  TONES,
  TONE_LABELS,
  buildVenueContext,
} from '@/lib/ai'
import AiConfigForm, { type AiConfigValues } from './AiConfigForm'

export default async function AiSettingsPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-[13px] text-mid">No venue is linked to your account yet.</p>
      </div>
    )
  }

  const context = buildVenueContext({
    id: venue.id,
    name: venue.name,
    type: venue.type,
    city: venue.city,
    address: venue.address,
    settings: venue.settings,
  })

  const initial: AiConfigValues = {
    assistantName: context.assistantName,
    tone:          context.config.tone,
    length:        context.config.length,
    houseRules:    context.config.houseRules ?? '',
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <AiConfigForm
        initial={initial}
        tones={TONES.map(t => ({ value: t, label: TONE_LABELS[t] }))}
        lengths={REPLY_LENGTHS.map(l => ({ value: l, label: REPLY_LENGTH_LABELS[l] }))}
        model={DEFAULT_MODEL}
      />
    </div>
  )
}
