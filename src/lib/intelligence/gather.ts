/**
 * Loads every row the intelligence layer needs, once, in parallel.
 *
 * Calculators downstream are pure functions over this snapshot. That keeps
 * business logic out of React, makes each rule testable without a database,
 * and means one page render costs one round of queries rather than one per
 * module.
 */

import { createAdminClient } from '@/lib/supabase/server'

export const WINDOW_DAYS = 30

export function windowBounds(now = Date.now()) {
  const day = 24 * 60 * 60 * 1000
  return {
    now: new Date(now).toISOString(),
    since30: new Date(now - WINDOW_DAYS * day).toISOString(),
    since60: new Date(now - 2 * WINDOW_DAYS * day).toISOString(),
    since90: new Date(now - 90 * day).toISOString(),
  }
}

export interface RawGuest {
  id: string
  name: string | null
  loyalty_tier: string
  loyalty_points: number
  total_visits: number
  total_spent: number
  last_visit_at: string | null
  created_at: string
}

export interface RawMember {
  id: string
  guest_id: string | null
  tier: string
  points_balance: number
  points_earned_total: number
  points_redeemed_total: number
  enrolled_at: string | null
  last_activity_at: string | null
  tier_upgraded_at: string | null
  birthday: string | null
}

export interface RawVisit {
  guest_id: string | null
  visited_at: string
  spend_amount: number | null
}

export interface RawReviewRequest {
  id: string
  status: string
  rating: number | null
  feedback: string | null
  created_at: string
  completed_at: string | null
}

export interface RawTransaction {
  type: string
  points: number
  created_at: string
}

export interface RawMessage {
  intent: string | null
  sentiment: string | null
  created_at: string
}

export interface RawConversation {
  id: string
  status: string
  created_at: string
}

export interface RawAiCall {
  success: boolean
  created_at: string
}

export interface RawActionItem {
  id: string
  title: string
  type: string
  priority: string
  created_at: string
}

export interface RawReservation {
  id: string
  guest_name: string | null
  party_size: number | null
  created_at: string
}

export interface RawReward {
  id: string
  name: string
  is_active: boolean
  redemption_count: number
}

export interface RawData {
  venueId: string
  guests: RawGuest[]
  members: RawMember[]
  visits: RawVisit[]
  reviewRequests: RawReviewRequest[]
  transactions: RawTransaction[]
  messages: RawMessage[]
  conversations: RawConversation[]
  aiCalls: RawAiCall[]
  actionItems: RawActionItem[]
  reservations: RawReservation[]
  rewards: RawReward[]
}

export async function gatherRawData(venueId: string): Promise<RawData> {
  const supabase = await createAdminClient()
  const { since90 } = windowBounds()

  const [
    guests, members, visits, reviewRequests, transactions,
    messages, conversations, aiCalls, actionItems, reservations, rewards,
  ] = await Promise.all([
    supabase
      .from('guests')
      .select('id, name, loyalty_tier, loyalty_points, total_visits, total_spent, last_visit_at, created_at')
      .eq('venue_id', venueId)
      .limit(2000),
    supabase
      .from('loyalty_members')
      .select('id, guest_id, tier, points_balance, points_earned_total, points_redeemed_total, enrolled_at, last_activity_at, tier_upgraded_at, birthday')
      .eq('venue_id', venueId)
      .limit(2000),
    supabase
      .from('visits')
      .select('guest_id, visited_at, spend_amount')
      .eq('venue_id', venueId)
      .gte('visited_at', since90)
      .limit(2000),
    supabase
      .from('review_requests')
      .select('id, status, rating, feedback, created_at, completed_at')
      .eq('venue_id', venueId)
      .limit(1000),
    supabase
      .from('loyalty_transactions')
      .select('type, points, created_at')
      .eq('venue_id', venueId)
      .limit(2000),
    supabase
      .from('messages')
      .select('intent, sentiment, created_at')
      .eq('venue_id', venueId)
      .eq('role', 'user')
      .gte('created_at', since90)
      .limit(1000),
    supabase
      .from('conversations')
      .select('id, status, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', since90)
      .limit(1000),
    supabase
      .from('ai_interactions')
      .select('success, created_at')
      .eq('venue_id', venueId)
      .gte('created_at', since90)
      .limit(1000),
    supabase
      .from('action_items')
      .select('id, title, type, priority, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .limit(200),
    supabase
      .from('reservation_requests')
      .select('id, guest_name, party_size, created_at')
      .eq('venue_id', venueId)
      .eq('status', 'pending')
      .limit(200),
    supabase
      .from('loyalty_rewards')
      .select('id, name, is_active, redemption_count')
      .eq('venue_id', venueId)
      .limit(100),
  ])

  return {
    venueId,
    guests:         (guests.data ?? []) as RawGuest[],
    members:        (members.data ?? []) as RawMember[],
    visits:         (visits.data ?? []) as RawVisit[],
    reviewRequests: (reviewRequests.data ?? []) as RawReviewRequest[],
    transactions:   (transactions.data ?? []) as RawTransaction[],
    messages:       (messages.data ?? []) as RawMessage[],
    conversations:  (conversations.data ?? []) as RawConversation[],
    aiCalls:        (aiCalls.data ?? []) as RawAiCall[],
    actionItems:    (actionItems.data ?? []) as RawActionItem[],
    reservations:   (reservations.data ?? []) as RawReservation[],
    rewards:        (rewards.data ?? []) as RawReward[],
  }
}

// ── Small shared helpers ──────────────────────────────────────────────────────

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null
  return Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
}

export function rate(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null
}

export function pct(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100)
}

/**
 * Change between two periods as a percentage.
 * Returns null when the previous period is empty — "up from zero" is not a
 * percentage anyone can act on.
 */
export function growth(current: number, previous: number): number | null {
  if (previous <= 0) return null
  return Math.round(((current - previous) / previous) * 100)
}
