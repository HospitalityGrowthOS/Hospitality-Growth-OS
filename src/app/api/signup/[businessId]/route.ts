/**
 * QR Loyalty Signup API
 * POST /api/signup/[businessId]
 *
 * Public — no auth required.
 * businessId = venue UUID or slug.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { sendLoyaltyWelcomeEmail } from '@/lib/email'
import { sendLoyaltyWelcome as sendLoyaltyWelcomeWhatsApp } from '@/lib/twilio'

const schema = z.object({
  name:     z.string().min(2, 'Name must be at least 2 characters').max(100),
  phone:    z.string().min(7, 'Enter a valid phone number').max(20),
  email:    z.string().email('Enter a valid email').optional().nullable(),
  birthday: z.string().optional().nullable(),
  consent:  z.literal(true, { errorMap: () => ({ message: 'Consent is required' }) }),
})

function getAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const WELCOME_POINTS = 50

export async function POST(
  req: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 })
    }
    const { name, phone, email, birthday } = parsed.data
    const { businessId } = params

    const supabase = getAdminClient()

    // Resolve venue — UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)
    const venueQuery = isUUID
      ? supabase.from('venues').select('id, name, slug, settings').eq('id', businessId).single()
      : supabase.from('venues').select('id, name, slug, settings').eq('slug', businessId).single()

    const { data: venue, error: venueError } = await venueQuery
    if (venueError || !venue) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const venueId = venue.id

    // Dedup by phone
    const { data: existingGuest } = await supabase
      .from('guests')
      .select('id')
      .eq('venue_id', venueId)
      .eq('phone', phone)
      .single()

    if (existingGuest) {
      const { data: existingMember } = await supabase
        .from('loyalty_members')
        .select('id, tier, points_balance, qr_code, enrolled_at')
        .eq('venue_id', venueId)
        .eq('guest_id', existingGuest.id)
        .single()

      if (existingMember) {
        const settings = venue.settings as Record<string, unknown>
        const silverThreshold = (settings?.silver_threshold as number) || 500
        return NextResponse.json({
          status: 'already_enrolled',
          member: {
            id:                 existingMember.id,
            name,
            points:             existingMember.points_balance,
            tier:               existingMember.tier,
            qr_code:            existingMember.qr_code,
            venue_name:         venue.name,
            enrolled_at:        existingMember.enrolled_at,
            points_to_next_tier: Math.max(0, silverThreshold - existingMember.points_balance),
            next_tier:          'silver',
            next_tier_threshold: silverThreshold,
          },
        })
      }
    }

    // Create or update guest record
    let guestId: string
    if (existingGuest) {
      guestId = existingGuest.id
      await supabase.from('guests').update({
        name,
        ...(email ? { email } : {}),
        whatsapp_opted_in: true,
      }).eq('id', guestId)
    } else {
      const { data: newGuest, error: guestError } = await supabase
        .from('guests')
        .insert({
          venue_id:         venueId,
          name,
          phone,
          email:            email || null,
          whatsapp_opted_in: true,
          loyalty_tier:     'bronze',
          loyalty_points:   WELCOME_POINTS,
          total_visits:     0,
          total_spent:      0,
        })
        .select('id')
        .single()

      if (guestError || !newGuest) {
        console.error('[signup] Guest insert error:', guestError)
        return NextResponse.json({ error: 'Failed to create guest record' }, { status: 500 })
      }
      guestId = newGuest.id
    }

    // Generate unique QR code
    const slug = (venue.slug || venue.id.slice(0, 8)).toUpperCase()
    const suffix = Math.random().toString(36).slice(2, 10).toUpperCase()
    const qrCode = `HGOS-${slug}-${suffix}`

    // Create loyalty member
    const { data: member, error: memberError } = await supabase
      .from('loyalty_members')
      .insert({
        venue_id:           venueId,
        guest_id:           guestId,
        qr_code:            qrCode,
        tier:               'bronze',
        points_balance:     WELCOME_POINTS,
        points_earned_total: WELCOME_POINTS,
        enrolled_at:        new Date().toISOString(),
        birthday:           birthday || null,
      })
      .select('id, tier, points_balance, qr_code, enrolled_at')
      .single()

    if (memberError || !member) {
      console.error('[signup] Member insert error:', memberError)
      return NextResponse.json({ error: 'Failed to create loyalty membership' }, { status: 500 })
    }

    // Welcome points transaction
    await supabase.from('loyalty_transactions').insert({
      venue_id:    venueId,
      member_id:   member.id,
      type:        'bonus',
      points:      WELCOME_POINTS,
      description: 'Welcome bonus — loyalty signup',
      reference_id: member.id,
    })

    // Fire welcome email if provided — non-blocking
    if (email) {
      sendLoyaltyWelcomeEmail({
        to:        email,
        name,
        venueName: venue.name,
        points:    WELCOME_POINTS,
        tier:      'bronze',
        qrCode,
        memberId:  member.id,
      }).catch(err => console.error('[signup] Email error:', err))
    }

    // WhatsApp loyalty welcome — fire-and-forget
    sendLoyaltyWelcomeWhatsApp({
      phone:     phone,
      guestName: name,
      venueName: venue.name,
      points:    WELCOME_POINTS,
      memberId:  member.id,
      venueId,
      guestId,
    }).catch(err => console.error('[signup] WhatsApp error:', err))

    // n8n webhook stub — fire-and-forget
    const n8nWebhook = process.env.N8N_LOYALTY_SIGNUP_WEBHOOK
    if (n8nWebhook) {
      fetch(n8nWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'loyalty.signup',
          venue_id: venueId,
          venue_name: venue.name,
          guest: { id: guestId, name, phone, email, birthday },
          member: { id: member.id, qr_code: qrCode, tier: 'bronze', points: WELCOME_POINTS },
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {})
    }

    const settings = venue.settings as Record<string, unknown>
    const silverThreshold = (settings?.silver_threshold as number) || 500

    return NextResponse.json({
      status: 'enrolled',
      member: {
        id:                  member.id,
        name,
        points:              member.points_balance,
        tier:                member.tier,
        qr_code:             member.qr_code,
        venue_name:          venue.name,
        enrolled_at:         member.enrolled_at,
        points_to_next_tier: silverThreshold - WELCOME_POINTS,
        next_tier:           'silver',
        next_tier_threshold: silverThreshold,
      },
    }, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0].message }, { status: 400 })
    }
    console.error('[signup] Error:', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}

// GET — fetch venue info for the signup page (public)
export async function GET(
  _req: NextRequest,
  { params }: { params: { businessId: string } }
) {
  const supabase = getAdminClient()
  const { businessId } = params
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(businessId)
  const query = isUUID
    ? supabase.from('venues').select('id, name, type, city, settings').eq('id', businessId).single()
    : supabase.from('venues').select('id, name, type, city, settings').eq('slug', businessId).single()

  const { data, error } = await query
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ venue: data })
}
