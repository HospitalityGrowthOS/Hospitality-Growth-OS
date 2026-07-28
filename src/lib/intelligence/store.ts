/**
 * Recommendation persistence.
 *
 * Reuses the existing `ai_recommendations` table rather than introducing a
 * parallel one. Recommendations are recomputed on every page load, so the
 * stored copy exists for state the computation cannot know: whether the owner
 * has actioned or dismissed one, and when it first appeared.
 */

import { createAdminClient } from '@/lib/supabase/server'
import { DEFAULT_MODEL } from '@/lib/ai'
import type { Recommendation } from './types'

/** How long a stored recommendation stays relevant before it is recomputed. */
const EXPIRES_AFTER_DAYS = 7

export interface StoredRecommendation {
  id: string
  type: string
  status: string
  generatedAt: string | null
}

/**
 * Writes any recommendation not already pending for this venue.
 *
 * Deduped on `type`, so a rule that keeps firing does not accumulate rows —
 * and a dismissed recommendation is not silently resurrected on the next load.
 */
export async function persistRecommendations(
  venueId: string,
  recommendations: Recommendation[]
): Promise<void> {
  if (!recommendations.length) return

  try {
    const supabase = await createAdminClient()

    const { data: existing } = await supabase
      .from('ai_recommendations')
      .select('type, status')
      .eq('venue_id', venueId)
      .in('status', ['pending', 'snoozed', 'dismissed'])

    const alreadyKnown = new Set((existing ?? []).map(r => r.type))
    const fresh = recommendations.filter(r => !alreadyKnown.has(r.type))
    if (!fresh.length) return

    const expiresAt = new Date(Date.now() + EXPIRES_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString()

    await supabase.from('ai_recommendations').insert(
      fresh.map(r => ({
        venue_id: venueId,
        type: r.type,
        title: r.title,
        description: r.description,
        priority: r.priority,
        status: 'pending' as const,
        // `data` carries the evidence, so a stored recommendation can still be
        // explained months later without rerunning the rule.
        data: {
          category: r.category,
          confidence: r.confidence,
          supporting_metrics: r.supportingMetrics,
        },
        generated_at: r.generatedAt,
        model_used: `rules+${DEFAULT_MODEL}`,
        expires_at: expiresAt,
      }))
    )
  } catch (err) {
    // Persistence is bookkeeping — the dashboard must still render without it.
    console.error('[intelligence] could not persist recommendations:', err)
  }
}

/** Recommendations the owner has already seen, for status and first-seen date. */
export async function loadStoredRecommendations(venueId: string): Promise<StoredRecommendation[]> {
  try {
    const supabase = await createAdminClient()
    const { data } = await supabase
      .from('ai_recommendations')
      .select('id, type, status, generated_at')
      .eq('venue_id', venueId)
      .order('created_at', { ascending: false })
      .limit(100)

    return (data ?? []).map(r => ({
      id: r.id,
      type: r.type,
      status: r.status,
      generatedAt: r.generated_at,
    }))
  } catch {
    return []
  }
}
