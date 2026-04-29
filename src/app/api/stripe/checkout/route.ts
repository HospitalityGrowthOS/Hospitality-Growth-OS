import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { plan } = await request.json() as { plan: PlanKey }

    if (!plan || !PLANS[plan]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const planConfig = PLANS[plan]

    if (!planConfig.priceId) {
      return NextResponse.json(
        { error: 'Plan not configured. Set STRIPE_PRICE_* env vars.' },
        { status: 500 }
      )
    }

    // Get authenticated user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Get venue
    const { data: venue } = await admin
      .from('venues')
      .select('id, name')
      .eq('owner_id', user.id)
      .single()

    // Check for existing Stripe customer
    const { data: existingSub } = await admin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .single()

    let customerId = existingSub?.stripe_customer_id

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          user_id: user.id,
          venue_id: venue?.id || '',
          venue_name: venue?.name || '',
        },
      })
      customerId = customer.id
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: planConfig.priceId, quantity: 1 }],
      success_url: `${baseUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout/cancel`,
      subscription_data: {
        metadata: {
          user_id: user.id,
          venue_id: venue?.id || '',
          plan,
        },
      },
      metadata: {
        user_id: user.id,
        venue_id: venue?.id || '',
        plan,
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    })

    return NextResponse.json({ url: session.url })
  } catch (e: any) {
    console.error('[stripe/checkout] error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
