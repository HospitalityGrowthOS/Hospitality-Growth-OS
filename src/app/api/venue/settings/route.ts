import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentVenue } from '@/lib/venue'
import { FAQ_TOPICS, REPLY_LENGTHS, TONES } from '@/lib/ai'
import type { Database, Json } from '@/types/database'

/**
 * Nested blobs are merged key by key rather than replaced, so a form that
 * submits only the fields it owns cannot wipe the rest.
 */
const SettingsSchema = z.object({
  name:              z.string().min(1).max(120).optional(),
  city:              z.string().max(120).optional(),
  address:           z.string().max(300).optional(),
  google_review_url: z.string().url().or(z.literal('')).optional(),
  ai_persona_name:   z.string().max(60).optional(),
  review_delay_minutes: z.number().int().min(5).max(1440).optional(),
  points_per_euro:   z.number().min(0).max(1000).optional(),

  /** Knowledge Base entries, keyed by FAQ topic. Empty string clears a topic. */
  faq: z.record(z.enum(FAQ_TOPICS), z.string().max(2000)).optional(),

  /** Assistant voice settings. */
  ai: z.object({
    tone:        z.enum(TONES).optional(),
    length:      z.enum(REPLY_LENGTHS).optional(),
    house_rules: z.string().max(2000).optional(),
  }).optional(),
})

/** Merges a partial object into an existing one, dropping cleared entries. */
function mergeBlob(
  current: unknown,
  incoming: Record<string, string | undefined>
): Record<string, Json> {
  const base = (current && typeof current === 'object' ? current : {}) as Record<string, Json>
  const out: Record<string, Json> = { ...base }

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined) continue
    // A blank value means the owner cleared the field — remove it entirely so
    // the FAQ resolver treats the topic as unanswered rather than empty.
    if (value.trim() === '') delete out[key]
    else out[key] = value.trim()
  }
  return out
}

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

  const { name, city, address, faq, ai, ...scalarFields } = parsed.data
  const admin = await createAdminClient()

  const current = (venue.settings || {}) as Record<string, Json>
  const settings: Record<string, Json> = { ...current }

  for (const [key, value] of Object.entries(scalarFields)) {
    if (value !== undefined) settings[key] = value as Json
  }

  if (faq) settings.faq = mergeBlob(current.faq, faq)
  if (ai)  settings.ai  = mergeBlob(current.ai, ai)

  const patch: Database['public']['Tables']['venues']['Update'] = { settings }
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
