/**
 * Built-in workflow templates.
 *
 * A template is nothing but a pre-filled `WorkflowInput` — it configures the
 * engine and contains no logic of its own. Installing one creates an ordinary
 * workflow the owner can then edit freely, which is why templates cannot drift
 * from what the engine actually supports.
 *
 * Every template installs as a `draft`. Nothing starts messaging guests
 * because someone clicked "use template".
 */

import type { WorkflowInput } from './types'

export interface WorkflowTemplate {
  key: string
  name: string
  description: string
  category: string
  /** What the owner should check before activating. */
  note?: string
  build: () => WorkflowInput
}

export const TEMPLATES: WorkflowTemplate[] = [
  {
    key: 'loyalty_welcome',
    name: 'Loyalty welcome journey',
    description: 'Thank a guest for joining and tell them how the programme works.',
    category: 'Loyalty',
    build: () => ({
      name: 'Loyalty welcome journey',
      description: 'Sent shortly after a guest enrols.',
      triggerEvent: 'loyalty.member_joined',
      conditions: [{ field: 'guest.whatsapp_opted_in', operator: 'eq', value: true }],
      actions: [{
        type: 'send_whatsapp',
        config: {
          message: 'Welcome to {{ venue.name }}, {{ guest.name }}! 🎉\n\nYou have {{ member.points_balance }} points to start with. Show your code on every visit to keep earning.',
        },
      }],
      schedule: { kind: 'delayed', delayMinutes: 5 },
      templateKey: 'loyalty_welcome',
    }),
  },
  {
    key: 'birthday_campaign',
    name: 'Birthday campaign',
    description: 'Wish a member happy birthday and credit a bonus.',
    category: 'Loyalty',
    note: 'Fires from a birthday event; check the bonus amount before activating.',
    build: () => ({
      name: 'Birthday campaign',
      description: 'Birthday greeting with a points bonus.',
      triggerEvent: 'loyalty.member_joined',
      triggerConfig: {},
      conditions: [{ field: 'guest.birthday', operator: 'within_days', value: 1 }],
      actions: [
        { type: 'issue_loyalty_points', config: { points: 200, reason: 'Birthday bonus' } },
        { type: 'send_whatsapp', config: { message: '🎂 Happy birthday, {{ guest.name }}! We have added 200 points to your balance at {{ venue.name }}.' } },
      ],
      schedule: { kind: 'immediate' },
      templateKey: 'birthday_campaign',
    }),
  },
  {
    key: 'tier_upgrade_reward',
    name: 'Tier upgrade reward',
    description: 'Congratulate a member who moves up a tier.',
    category: 'Loyalty',
    build: () => ({
      name: 'Tier upgrade reward',
      description: 'Recognises a tier change.',
      triggerEvent: 'loyalty.tier_changed',
      conditions: [],
      actions: [{
        type: 'send_whatsapp',
        config: { message: 'Congratulations {{ guest.name }} — you have reached {{ event.to_tier }} status at {{ venue.name }}! 🎉' },
      }],
      schedule: { kind: 'immediate' },
      templateKey: 'tier_upgrade_reward',
    }),
  },
  {
    key: 'gold_member_congratulations',
    name: 'Gold member recognition',
    description: 'Alert the team when a guest reaches Gold so they can be greeted personally.',
    category: 'Loyalty',
    build: () => ({
      name: 'Gold member recognition',
      description: 'Notifies the owner rather than the guest.',
      triggerEvent: 'loyalty.tier_changed',
      conditions: [{ field: 'event.to_tier', operator: 'eq', value: 'gold' }],
      actions: [{
        type: 'notify_owner',
        config: { title: 'New Gold member', message: '{{ guest.name }} has reached Gold. Worth a personal welcome on their next visit.' },
      }],
      schedule: { kind: 'immediate' },
      templateKey: 'gold_member_congratulations',
    }),
  },
  {
    key: 'inactive_reactivation',
    name: 'Inactive guest reactivation',
    description: 'Reach out to a member who has not visited in a while.',
    category: 'Retention',
    note: 'Runs when a visit is recorded for someone long absent. A scheduled sweep needs the recurring runner.',
    build: () => ({
      name: 'Inactive guest reactivation',
      description: 'Win-back message for lapsed members.',
      triggerEvent: 'loyalty.points_awarded',
      conditions: [
        { field: 'member.last_activity_at', operator: 'older_than_days', value: 60 },
        { field: 'guest.whatsapp_opted_in', operator: 'eq', value: true },
      ],
      actions: [{
        type: 'send_whatsapp',
        config: { message: 'We have missed you, {{ guest.name }}! Your {{ member.points_balance }} points are still waiting at {{ venue.name }}.' },
      }],
      schedule: { kind: 'immediate' },
      templateKey: 'inactive_reactivation',
    }),
  },
  {
    key: 'reservation_reminder',
    name: 'Reservation reminder',
    description: 'Remind a guest ahead of their booking.',
    category: 'Reservations',
    note: 'Fires on confirmation, so a guest is never reminded about a table they were never given.',
    build: () => ({
      name: 'Reservation reminder',
      description: 'Sent before a confirmed booking.',
      // Was 'reservation.created' — which fires when the request is captured,
      // before anyone has accepted it. Reminding a guest about a booking the
      // venue has not agreed to is worse than not reminding them at all.
      triggerEvent: 'reservation.confirmed',
      conditions: [],
      actions: [{
        type: 'send_whatsapp',
        config: { message: 'Looking forward to seeing you at {{ venue.name }}, {{ guest.name }}. Reply here if anything changes.' },
      }],
      schedule: { kind: 'delayed', delayMinutes: 1440 },
      templateKey: 'reservation_reminder',
    }),
  },
  {
    key: 'review_request_follow_up',
    name: 'Review request follow-up',
    description: 'Thank a guest who leaves a positive rating.',
    category: 'Reviews',
    build: () => ({
      name: 'Review request follow-up',
      description: 'Thanks guests who rated well.',
      triggerEvent: 'review.positive',
      conditions: [{ field: 'event.rating', operator: 'gte', value: 4 }],
      actions: [{
        type: 'send_whatsapp',
        config: { message: 'Thank you for the kind words, {{ guest.name }} — it genuinely helps a small business like ours. See you soon at {{ venue.name }}!' },
      }],
      schedule: { kind: 'delayed', delayMinutes: 60 },
      templateKey: 'review_request_follow_up',
    }),
  },
  {
    key: 'negative_review_recovery',
    name: 'Negative review recovery',
    description: 'Put a poor rating in front of the owner immediately, with a task to follow up.',
    category: 'Reviews',
    note: 'Deliberately alerts the team rather than auto-messaging the guest — recovery should be personal.',
    build: () => ({
      name: 'Negative review recovery',
      description: 'Escalates criticism to the owner.',
      triggerEvent: 'review.negative',
      conditions: [{ field: 'event.rating', operator: 'lte', value: 3 }],
      actions: [
        { type: 'notify_owner', config: { title: 'Unhappy guest needs a reply', message: '{{ guest.name }} rated {{ event.rating }}/5: "{{ event.feedback }}"' } },
        { type: 'create_action_item', config: { title: 'Follow up with {{ guest.name }}', description: 'Rated {{ event.rating }}/5. Call or message personally within 24 hours.', priority: 'high' } },
      ],
      schedule: { kind: 'immediate' },
      templateKey: 'negative_review_recovery',
    }),
  },
]

export function getTemplate(key: string): WorkflowTemplate | null {
  return TEMPLATES.find(t => t.key === key) ?? null
}

export function templatesByCategory(): { category: string; templates: WorkflowTemplate[] }[] {
  const order: string[] = []
  const groups = new Map<string, WorkflowTemplate[]>()
  for (const t of TEMPLATES) {
    if (!groups.has(t.category)) { groups.set(t.category, []); order.push(t.category) }
    groups.get(t.category)!.push(t)
  }
  return order.map(category => ({ category, templates: groups.get(category)! }))
}
