import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'

const SettingsSchema = z.object({
  name:              z.string().min(1).max(120).optional(),
  city:              z.string().max(120).optional(),
  address:           z.string().max(300).optional(),
  google_review_url: z.string().url().or(z.literal('')).optional(),
  ai_persona_name:   z.string().max(60).optional(),
  review_delay_minutes: z.number().int().min(5).max(1440).optional(),
  points_per_euro:   z.number().min(0).max(1000).optional(),
})

export async function PATCH(req: NextRequest) {
  const venue = await getCurrentVenue()
  if (!venue) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = SettingsSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', details: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const { name, city, address, ...settingsFields } = parsed.data
  const admin = await createAdminClient()

  // Merge into the existing settings blob rather than replacing it, so keys we
  // don't expose in this form survive.
  const current = (venue.settings || {}) as Record<string, unknown>
  const settings: Record<string, unknown> = { ...current }
  for (const [key, value] of Object.entries(settingsFields)) {
    if (value !== undefined) settings[key] = value
  }

  const patch: Record<string, unknown> = { settings }
  if (name !== undefined)    patch.name = name
  if (city !== undefined)    patch.city = city
  if (address !== undefined) patch.address = address

  const { error } = await admin.from('venues').update(patch).eq('id', venue.id)

  if (error) {
    console.error('[venue/settings] update error:', error)
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
