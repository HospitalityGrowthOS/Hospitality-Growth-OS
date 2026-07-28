/**
 * Types for the Growth Intelligence Engine.
 *
 * Everything here is computed from real platform data. Nothing in this module
 * fabricates a metric: when the data behind a figure does not exist, the field
 * is null and the UI shows a placeholder instead.
 */

// ── Health score ──────────────────────────────────────────────────────────────

export interface HealthComponent {
  key: 'reputation' | 'momentum' | 'loyalty' | 'operations'
  label: string
  /** 0–100, or null when there is not enough data to judge. */
  score: number | null
  /** Weight actually applied after renormalisation. */
  weight: number
  /** One sentence explaining what produced the score. */
  basis: string
}

export interface HealthScore {
  /** 0–100, or null when no component has data. */
  overall: number | null
  components: HealthComponent[]
  /** Plain-language reading of the overall number. */
  verdict: string
}

// ── Metrics ───────────────────────────────────────────────────────────────────

export interface CustomerIntelligence {
  totalGuests: number
  newGuests30d: number
  newGuestsPrev30d: number
  returningGuests30d: number
  uniqueVisitors30d: number
  loyaltyMembers: number
  newMembers30d: number
  tierDistribution: { tier: string; count: number }[]
  inactiveGuests: InactiveGuest[]
  topGuests: TopGuest[]
  /** Natural-language observations, each backed by the numbers above. */
  insights: string[]
}

export interface InactiveGuest {
  id: string
  name: string | null
  tier: string
  points: number
  daysInactive: number
}

export interface TopGuest {
  id: string
  name: string | null
  tier: string
  visits: number
  totalSpent: number
}

export interface LoyaltyIntelligence {
  totalMembers: number
  pointsIssued: number
  pointsRedeemed: number
  /** null when nothing has been issued yet. */
  redemptionRate: number | null
  newMembers30d: number
  newMembersPrev30d: number
  tierUpgrades30d: number
  activeRewards: number
  rewardRedemptions: number
  engagementRate: number | null
  insights: string[]
}

export interface ReviewIntelligence {
  requestsSent: number
  requestsCompleted: number
  completionRate: number | null
  averageRating: number | null
  positiveCount: number
  negativeCount: number
  sentimentDistribution: { sentiment: string; count: number }[]
  /** Ratings by week for the trend, oldest first. */
  weeklyTrend: { weekStart: string; count: number; avgRating: number | null }[]
  recentNegative: { rating: number; feedback: string | null; when: string }[]
  insights: string[]
}

// ── Recommendations ───────────────────────────────────────────────────────────

export type RecommendationCategory =
  | 'retention'
  | 'loyalty'
  | 'reviews'
  | 'assistant'
  | 'operations'

export interface Recommendation {
  /** Stable rule identifier, used for dedupe against pending rows. */
  type: string
  title: string
  description: string
  category: RecommendationCategory
  priority: 'high' | 'medium' | 'low'
  /**
   * 0–1. A data-volume heuristic, not a probability: how much evidence sits
   * behind the rule (sample size relative to the rule's threshold).
   */
  confidence: number
  /** The real figures that triggered the rule. */
  supportingMetrics: Record<string, number | string>
  generatedAt: string
}

// ── Opportunities ─────────────────────────────────────────────────────────────

export type OpportunityKind =
  | 'reactivation'
  | 'birthday'
  | 'vip'
  | 'tier_upgrade'
  | 'review_recovery'

export interface Opportunity {
  kind: OpportunityKind
  title: string
  description: string
  /** How many guests this concerns. */
  audienceSize: number
  supportingMetrics: Record<string, number | string>
}

// ── Timeline ──────────────────────────────────────────────────────────────────

export type TimelineEventKind =
  | 'member_enrolled'
  | 'tier_upgrade'
  | 'negative_feedback'
  | 'escalation'
  | 'recommendation'
  | 'reservation_request'
  | 'review_received'

export interface TimelineEvent {
  kind: TimelineEventKind
  title: string
  detail: string | null
  at: string
}

// ── Snapshot ──────────────────────────────────────────────────────────────────

/** Everything the executive overview needs, computed in one pass. */
export interface IntelligenceSnapshot {
  health: HealthScore
  customers: CustomerIntelligence
  loyalty: LoyaltyIntelligence
  reviews: ReviewIntelligence
  recommendations: Recommendation[]
  opportunities: Opportunity[]
  timeline: TimelineEvent[]
  /** Signals the assistant produced that the owner should read. */
  assistant: {
    conversations30d: number
    escalations30d: number
    escalationRate: number | null
    aiFailures30d: number
    pendingReservations: number
    unansweredTopics: string[]
  }
  generatedAt: string
}
