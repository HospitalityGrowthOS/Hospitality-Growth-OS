import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/server'
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
    console.error('[webhook] upsert error:', JSON.stringify(error))
  } else {
    console.log('[webhook] upsert success for user_id:', data.user_id)
  }
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

        await admin
          .from('subscriptions')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        if (invoice.subscription) {
          await admin
            .from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', invoice.subscription as string)
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
