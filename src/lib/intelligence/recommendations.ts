/**
 * Recommendation engine.
 *
 * Rules are deliberately deterministic rather than model-generated: a
 * recommendation that tells an owner to act on a number must be reproducible
 * and explainable, and every one carries the figures that triggered it.
 *
 * Adding a rule means appending one entry to RULES. Each rule declares the
 * minimum evidence it needs, so a venue with three guests does not get advice
 * derived from three guests.
 *
 * `confidence` is a data-volume heuristic — how much evidence sits behind the
 * rule relative to its threshold — not a probability that the advice is right.
 */

import { INACTIVE_AFTER_DAYS } from './customers'
import type { RawData } from './gather'
import type {
  CustomerIntelligence,
  LoyaltyIntelligence,
  Recommendation,
  RecommendationCategory,
  ReviewIntelligence,
} from './types'

export interface RuleContext {
  raw: RawData
  customers: CustomerIntelligence
  loyalty: LoyaltyIntelligence
  reviews: ReviewIntelligence
  /** Topics the assistant has no answer for. */
  unansweredTopics: string[]
  /** Intents seen in the last 90 days, most common first. */
  topIntents: { intent: string; count: number }[]
}

interface Rule {
  type: string
  category: RecommendationCategory
  /** Returns null when the rule does not apply. */
  evaluate(ctx: RuleContext): Omit<Recommendation, 'type' | 'category' | 'generatedAt'> | null
}

/** Scales evidence against a threshold into a 0.5–0.95 confidence band. */
function confidenceFrom(observed: number, threshold: number): number {
  if (observed <= 0) return 0.5
  const ratio = Math.min(observed / Math.max(threshold, 1), 4)
  return Number(Math.min(0.95, 0.5 + ratio * 0.12).toFixed(2))
}

const RULES: Rule[] = [
  {
    type: 'guests_going_inactive',
    category: 'retention',
    evaluate({ customers }) {
      const inactive = customers.inactiveGuests
      if (inactive.length < 3) return null

      const byTier = new Map<string, number>()
      for (const g of inactive) byTier.set(g.tier, (byTier.get(g.tier) ?? 0) + 1)
      const [topTier, topCount] = Array.from(byTier.entries()).sort((a, b) => b[1] - a[1])[0]

      const share = customers.loyaltyMembers
        ? Math.round((inactive.length / customers.loyaltyMembers) * 100)
        : 0

      return {
        title: `${inactive.length} members have drifted away`,
        description:
          `${inactive.length} loyalty members have not visited in over ${INACTIVE_AFTER_DAYS} days` +
          `${customers.loyaltyMembers ? `, which is ${share}% of your programme` : ''}. ` +
          `The largest group is ${topTier} (${topCount}). A win-back message to this list is the cheapest revenue you have available.`,
        priority: share >= 40 ? 'high' : 'medium',
        confidence: confidenceFrom(inactive.length, 3),
        supportingMetrics: {
          inactive_members: inactive.length,
          share_of_programme: `${share}%`,
          largest_tier: topTier,
          largest_tier_count: topCount,
          longest_gap_days: inactive[0]?.daysInactive ?? 0,
        },
      }
    },
  },

  {
    type: 'points_never_redeemed',
    category: 'loyalty',
    evaluate({ loyalty }) {
      if (loyalty.pointsIssued < 500) return null
      if (loyalty.pointsRedeemed > 0 && (loyalty.redemptionRate ?? 0) >= 0.05) return null

      return {
        title: 'Points are being collected but never spent',
        description:
          `${loyalty.pointsIssued.toLocaleString()} points have been issued and ` +
          `${loyalty.pointsRedeemed.toLocaleString()} redeemed. ` +
          (loyalty.activeRewards === 0
            ? 'There are no active rewards, so guests have nothing to spend them on.'
            : 'Guests may not know what their points are worth — a message explaining the rewards usually moves this.'),
        priority: loyalty.activeRewards === 0 ? 'high' : 'medium',
        confidence: confidenceFrom(loyalty.pointsIssued, 500),
        supportingMetrics: {
          points_issued: loyalty.pointsIssued,
          points_redeemed: loyalty.pointsRedeemed,
          active_rewards: loyalty.activeRewards,
        },
      }
    },
  },

  {
    type: 'review_completion_low',
    category: 'reviews',
    evaluate({ reviews }) {
      if (reviews.requestsSent < 10) return null
      const completion = reviews.completionRate ?? 0
      if (completion >= 0.3) return null

      return {
        title: 'Most review requests go unanswered',
        description:
          `${reviews.requestsCompleted} of ${reviews.requestsSent} requests were answered ` +
          `(${Math.round(completion * 100)}%). Requests that arrive too long after a visit, or read as automated, ` +
          'tend to be ignored — the delay is adjustable in Settings.',
        priority: completion < 0.15 ? 'high' : 'medium',
        confidence: confidenceFrom(reviews.requestsSent, 10),
        supportingMetrics: {
          requests_sent: reviews.requestsSent,
          answered: reviews.requestsCompleted,
          completion_rate: `${Math.round(completion * 100)}%`,
        },
      }
    },
  },

  {
    type: 'negative_feedback_cluster',
    category: 'reviews',
    evaluate({ reviews }) {
      if (reviews.requestsCompleted < 5) return null
      const negativeShare = reviews.negativeCount / reviews.requestsCompleted
      if (negativeShare < 0.25) return null

      return {
        title: `${reviews.negativeCount} guests rated you below ${4} stars`,
        description:
          `That is ${Math.round(negativeShare * 100)}% of everyone who responded. ` +
          'These stayed private rather than reaching Google, so you still have the chance to put them right — ' +
          'the individual comments are listed under Review intelligence.',
        priority: negativeShare >= 0.4 ? 'high' : 'medium',
        confidence: confidenceFrom(reviews.requestsCompleted, 5),
        supportingMetrics: {
          negative: reviews.negativeCount,
          responses: reviews.requestsCompleted,
          negative_share: `${Math.round(negativeShare * 100)}%`,
          average_rating: reviews.averageRating ?? 'n/a',
        },
      }
    },
  },

  {
    type: 'assistant_knowledge_gaps',
    category: 'assistant',
    evaluate({ unansweredTopics, raw }) {
      if (unansweredTopics.length < 3) return null
      const conversations = raw.conversations.length

      return {
        title: `The assistant cannot answer ${unansweredTopics.length} common topics`,
        description:
          `${unansweredTopics.join(', ')} have no answer, so the assistant tells guests it will check with your team. ` +
          'Filling these in under Knowledge Base turns each one into an immediate answer.',
        priority: conversations >= 10 ? 'high' : 'medium',
        confidence: confidenceFrom(unansweredTopics.length, 3),
        supportingMetrics: {
          unanswered_topics: unansweredTopics.length,
          topics: unansweredTopics.join(', '),
          conversations_handled: conversations,
        },
      }
    },
  },

  {
    type: 'frequent_unresolved_questions',
    category: 'assistant',
    evaluate({ topIntents, raw }) {
      const unknown = topIntents.find(i => i.intent === 'unknown')
      if (!unknown || unknown.count < 5) return null
      const total = raw.messages.length || 1

      return {
        title: 'Guests are asking things the assistant cannot classify',
        description:
          `${unknown.count} of ${total} guest messages could not be placed into a known topic ` +
          `(${Math.round((unknown.count / total) * 100)}%). Reading these under Conversations usually reveals a gap worth adding to the Knowledge Base.`,
        priority: 'medium',
        confidence: confidenceFrom(unknown.count, 5),
        supportingMetrics: {
          unclassified: unknown.count,
          total_messages: total,
        },
      }
    },
  },

  {
    type: 'escalations_rising',
    category: 'operations',
    evaluate({ raw }) {
      const conversations = raw.conversations.length
      if (conversations < 10) return null
      const escalated = raw.conversations.filter(c => c.status === 'escalated').length
      const escalationRate = escalated / conversations
      if (escalationRate < 0.3) return null

      return {
        title: `${Math.round(escalationRate * 100)}% of conversations need a person`,
        description:
          `${escalated} of ${conversations} conversations were handed to your team. ` +
          'A high rate usually means the assistant is missing knowledge rather than that guests are unhappy — ' +
          'the Safety centre shows which questions it could not handle.',
        priority: escalationRate >= 0.5 ? 'high' : 'medium',
        confidence: confidenceFrom(conversations, 10),
        supportingMetrics: {
          escalated,
          conversations,
          escalation_rate: `${Math.round(escalationRate * 100)}%`,
        },
      }
    },
  },

  {
    type: 'gold_members_not_returning',
    category: 'retention',
    evaluate({ customers }) {
      const goldInactive = customers.inactiveGuests.filter(g => g.tier === 'gold')
      if (goldInactive.length < 2) return null

      return {
        title: `${goldInactive.length} Gold members have stopped coming`,
        description:
          'Your highest-value guests have not visited in over a month. ' +
          'These are the most worthwhile people to contact personally rather than by campaign.',
        priority: 'high',
        confidence: confidenceFrom(goldInactive.length, 2),
        supportingMetrics: {
          gold_inactive: goldInactive.length,
          longest_gap_days: goldInactive[0]?.daysInactive ?? 0,
        },
      }
    },
  },

  {
    type: 'no_visits_recorded',
    category: 'operations',
    evaluate({ raw, customers }) {
      if (customers.loyaltyMembers < 3) return null
      if (raw.visits.length > 0) return null

      return {
        title: 'No visits are being recorded',
        description:
          `You have ${customers.loyaltyMembers} loyalty members but no recorded visits, so no points are awarded ` +
          'and no review requests go out. Recording a visit when a guest pays is what starts both.',
        priority: 'high',
        confidence: 0.9,
        supportingMetrics: {
          loyalty_members: customers.loyaltyMembers,
          visits_recorded: 0,
        },
      }
    },
  },
]

/** Runs every rule and returns those that fired, most urgent first. */
export function generateRecommendations(ctx: RuleContext): Recommendation[] {
  const generatedAt = new Date().toISOString()
  const order = { high: 0, medium: 1, low: 2 } as const

  return RULES
    .map(rule => {
      const result = rule.evaluate(ctx)
      if (!result) return null
      return { ...result, type: rule.type, category: rule.category, generatedAt }
    })
    .filter((r): r is Recommendation => r !== null)
    .sort((a, b) => order[a.priority] - order[b.priority] || b.confidence - a.confidence)
}

export const RULE_COUNT = RULES.length
