import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
import { mustWrite } from '@/lib/db'
import type Stripe from 'stripe'

// Required: raw body for webhook signature verification
export const dynamic = 'force-dynamic'

// Stripe 2026-03-25: current_period_end moved to subscription.items.data[0]
function getPeriodEnd(subscription: Stripe.Subscription): string | undefined {
  const ts =
    (subscription as any).current_period_end ??
    (subscription.items?.data?.[0] as any)?.current_period_end
  if (!ts || isNaN(ts)) return undefined
  return new Date(ts * 1000).toISOString()
}

async function upsertSubscription(
  admin: Awaited<ReturnType<typeof createAdminClient>>,
  data: {
    user_id: string
    venue_id?: string
    plan: string
    status: string
    stripe_customer_id: string
    stripe_subscription_id: string
    current_period_end?: string
  }
) {
  const { error } = await admin
    .from('subscriptions')
    .upsert(
      {
        ...data,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'stripe_subscription_id' }
    )

  if (error) {
    // Throwing turns this into a 500 so Stripe retries the event; swallowing
    // it would leave the account on the wrong plan with no record of why.
    throw new Error(`[webhook] subscription upsert failed for user ${data.user_id}: ${error.message}`)
  }
  console.log('[webhook] upsert success for user_id:', data.user_id)
}

/**
 * Locate the subscription on an invoice across Stripe API versions.
 *
 * Up to 2025-03-31 the id sat at `invoice.subscription`. From 2025-04 it moved
 * to `invoice.parent.subscription_details.subscription`. Webhook payloads are
 * serialised with the version configured on the Stripe endpoint, which is not
 * necessarily the version this SDK targets, so both shapes must be handled —
 * otherwise a failed payment silently fails to mark the account past due.
 */
function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const modern = invoice.parent?.subscription_details?.subscription
  if (modern) return typeof modern === 'string' ? modern : modern.id

  const legacy = (invoice as unknown as { subscription?: string | { id: string } }).subscription
  if (legacy) return typeof legacy === 'string' ? legacy : legacy.id

  return null
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (e: any) {
    console.error('[webhook] signature error:', e.message)
    return NextResponse.json({ error: `Webhook Error: ${e.message}` }, { status: 400 })
  }

  const admin = await createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode !== 'subscription') break

        const userId = session.metadata?.user_id
        const venueId = session.metadata?.venue_id || undefined   // '' → undefined (avoids UUID parse error)
        const plan = session.metadata?.plan || 'growth'

        if (!userId) { console.error('[webhook] no user_id in metadata — metadata:', session.metadata); break }

        console.log('[webhook] checkout.session.completed — user_id:', userId, 'plan:', plan, 'venue_id:', venueId)

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)

        await upsertSubscription(admin, {
          user_id: userId,
          venue_id: venueId,
          plan,
          status: subscription.status,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_end: getPeriodEnd(subscription),
        })
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.user_id
        const venueId = subscription.metadata?.venue_id || undefined   // '' → undefined
        const plan = subscription.metadata?.plan || 'growth'

        if (!userId) break

        await upsertSubscription(admin, {
          user_id: userId,
          venue_id: venueId,
          plan,
          status: subscription.status,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          current_period_end: getPeriodEnd(subscription),
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // A throw here becomes a 500, which makes Stripe retry the event —
        // the correct recovery for a transient write failure.
        await mustWrite('stripe: mark subscription canceled', admin
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id))
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = subscriptionIdFromInvoice(invoice)
        if (subscriptionId) {
          await mustWrite('stripe: mark subscription past_due', admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subscriptionId))
        } else {
          console.warn('[webhook] payment_failed with no subscription on invoice', invoice.id)
        }
        break
      }

      default:
        // Unhandled event type — ignore
        break
    }
  } catch (e) {
    console.error('[webhook] handler error:', e)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
