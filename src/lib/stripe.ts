import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    // Must match the version this SDK's types are generated against, otherwise
    // the types describe a different API than we actually speak.
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-03-25.dahlia',
    })
  }
  return _stripe
}

// Convenience alias — only call inside request handlers, not at module level
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return (getStripe() as any)[prop]
  },
})

export const PLANS = {
  starter: {
    name: 'Starter',
    price: 199,
    currency: 'eur',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_STARTER!,
    features: [
      'Review Automation',
      'QR Loyalty Signup',
      'Up to 500 guests',
      'Email support',
    ],
    badge: null,
  },
  growth: {
    name: 'Growth',
    price: 499,
    currency: 'eur',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_GROWTH!,
    features: [
      'Everything in Starter',
      'AI Guest Assistant',
      'WhatsApp Campaigns',
      'CRM Dashboard',
      'Growth Intelligence',
      'Up to 2,000 guests',
      'Priority support',
    ],
    badge: 'Most Popular',
  },
  scale: {
    name: 'Scale',
    price: 1199,
    currency: 'eur',
    interval: 'month' as const,
    priceId: process.env.STRIPE_PRICE_SCALE!,
    features: [
      'Everything in Growth',
      'Multi-venue management',
      'Unlimited guests',
      'Custom AI training',
      'Dedicated account manager',
      'SLA guarantee',
    ],
    badge: null,
  },
} as const

export type PlanKey = keyof typeof PLANS
