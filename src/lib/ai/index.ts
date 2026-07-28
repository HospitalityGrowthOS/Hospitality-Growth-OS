/**
 * AI service layer for Hospitality Growth OS.
 *
 * Import from '@/lib/ai' — the internal modules are implementation detail.
 */

export * from './types'
export { isAiConfigured, DEFAULT_MODEL, type AiFeature } from './client'
export {
  FAQ_TOPICS,
  FAQ_TOPIC_LABELS,
  FAQ_TOPIC_HINTS,
  resolveFaq,
  missingFaqTopics,
  resolveAssistantConfig,
  buildVenueContext,
  type FaqTopic,
  type VenueLike,
} from './faq'
export {
  analyzeMessage,
  classifyIntent,
  detectSentiment,
  suggestEscalation,
  answerFAQ,
  handleGuestMessage,
  generateReviewReply,
  summarizeConversation,
  captureReservationRequest,
  escalateConversation,
} from './service'
export { getChannel, availableChannels, deliver } from './channels'
