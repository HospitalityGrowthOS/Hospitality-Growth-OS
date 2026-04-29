/**
 * Daily Automation Engine — runs at 09:00 every day
 * Handles: birthday campaigns, win-back sequences, tier push campaigns,
 *           weekly reports, KPI snapshot
 *
 * Called by Vercel Cron (vercel.json) or external cron service.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { sendText } from '@/lib/whatsapp'
import { generateWeeklyReport } from '@/lib/claude'
import { getTierEmoji } from '@/lib/utils'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, unknown> = {}
  const supabase = await createAdminClient()

  // Load all active venues
  const { data: venues } = await supabase.from('venues').select('*').eq('status', 'active')
  if (!venues?.length) return NextResponse.json({ message: 'No active venues' })

  for (const venue of venues) {
    const venueId = venue.id as string
    const settings = venue.settings as Record<string, unknown> || {}
    const phoneId = venue.whatsapp_phone_number_id as string
    const token = venue.whatsapp_access_token as string

    // ── 1. BIRTHDAY AUTOMATION ────────────────────────────────
    const todayMMDD = new Date().toISOString().substring(5, 10) // MM-DD
    const { data: birthdayMembers } = await supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('venue_id', venueId)
      .like('birthday', `%-${todayMMDD}`)

    let birthdaySent = 0
    if (birthdayMembers?.length && phoneId && token) {
      const bonusPoints = (settings.birthday_bonus_points as number) || 200
      for (const m of birthdayMembers) {
        const guest = m.guests as { name?: string; phone?: string }
        if (!guest?.phone) continue
        const firstName = guest.name?.split(' ')[0] || 'there'

        await Promise.all([
          sendText(phoneId, token, guest.phone,
            `🎂 Happy Birthday, ${firstName}!\n\nAll of us at *${venue.name}* wish you a wonderful day! 🎉\n\nWe've added *${bonusPoints} bonus points* to your loyalty balance as our birthday gift to you.\n\n${getTierEmoji(m.tier)} See you soon!`
          ),
          supabase.from('loyalty_transactions').insert({
            venue_id: venueId, member_id: m.id,
            type: 'bonus', points: bonusPoints, description: 'Birthday bonus',
          }),
          supabase.from('loyalty_members').update({ points_balance: m.points_balance + bonusPoints }).eq('id', m.id),
        ])
        birthdaySent++
      }
    }
    results[`${venueId}_birthdays`] = birthdaySent

    // ── 2. WIN-BACK CAMPAIGN (30-day inactive) ────────────────
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: inactiveMembers } = await supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('venue_id', venueId)
      .lt('last_activity_at', thirtyDaysAgo)
      .not('last_activity_at', 'is', null)

    let winbackSent = 0
    if (inactiveMembers?.length && phoneId && token) {
      const voucherAmount = (settings.winback_voucher as number) || 5
      for (const m of inactiveMembers) {
        const guest = m.guests as { name?: string; phone?: string }
        if (!guest?.phone) continue
        const firstName = guest.name?.split(' ')[0] || 'there'

        await sendText(phoneId, token, guest.phone,
          `Hi ${firstName}, we miss you! 🥺\n\nIt's been a while since we've seen you at *${venue.name}*.\n\nWe'd love to welcome you back with a *€${voucherAmount} credit* on your next visit — just show this message.\n\nValid for the next 7 days. See you soon! ❤️`
        )
        winbackSent++
      }
    }
    results[`${venueId}_winback`] = winbackSent

    // ── 3. TIER PUSH (guests close to next tier) ──────────────
    const { data: closeMembersRaw } = await supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('venue_id', venueId)
      .eq('tier', 'bronze')
      .gte('points_balance', 400)   // within 100pts of silver (500)
      .lt('points_balance', 500)

    const silverPush = (settings.tier_thresholds as { silver: number })?.silver || 500

    if (closeMembersRaw?.length && phoneId && token) {
      for (const m of closeMembersRaw) {
        const guest = m.guests as { name?: string; phone?: string }
        if (!guest?.phone) continue
        const firstName = guest.name?.split(' ')[0] || 'there'
        const ptsNeeded = silverPush - m.points_balance

        await sendText(phoneId, token, guest.phone,
          `${firstName}, you're *${ptsNeeded} points* away from Silver! 🥈\n\nVisit ${venue.name} and unlock exclusive Silver perks:\n• Priority seating\n• 2× points every Tuesday\n• Monthly surprise reward\n\nYou're almost there! 🚀`
        )
      }
    }

    // ── 4. WEEKLY AI REPORT (Mondays only) ───────────────────
    const isMonday = new Date().getDay() === 1
    if (isMonday) {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

      const [{ data: snap }, { data: prevSnap }] = await Promise.all([
        supabase.from('kpi_snapshots').select('*').eq('venue_id', venueId).order('date', { ascending: false }).limit(7),
        supabase.from('kpi_snapshots').select('*').eq('venue_id', venueId).lt('date', weekAgo).order('date', { ascending: false }).limit(7),
      ])

      if (snap?.length) {
        const thisWeek = {
          new_members: snap.reduce((a, r) => a + (r.new_members || 0), 0),
          reviews_received: snap.reduce((a, r) => a + (r.reviews_received || 0), 0),
          avg_rating: +(snap.reduce((a, r) => a + (r.avg_rating || 0), 0) / snap.length).toFixed(1),
          campaign_opens: snap.reduce((a, r) => a + (r.campaign_opens || 0), 0),
        }
        const lastWeek = prevSnap?.length ? {
          new_members: prevSnap.reduce((a, r) => a + (r.new_members || 0), 0),
          reviews_received: prevSnap.reduce((a, r) => a + (r.reviews_received || 0), 0),
          avg_rating: +(prevSnap.reduce((a, r) => a + (r.avg_rating || 0), 0) / prevSnap.length).toFixed(1),
          campaign_opens: prevSnap.reduce((a, r) => a + (r.campaign_opens || 0), 0),
        } : thisWeek

        const report = await generateWeeklyReport(venue.name as string, thisWeek, lastWeek)
        await supabase.from('weekly_reports').insert({ venue_id: venueId, report_date: new Date().toISOString().substring(0, 10), content: report, kpi_data: thisWeek })
      }
    }

    // ── 5. KPI SNAPSHOT (daily) ───────────────────────────────
    const today = new Date().toISOString().substring(0, 10)
    const todayStart = `${today}T00:00:00Z`

    const [{ count: newMembers }, { count: reviewsReceived }, { data: ratingData }] = await Promise.all([
      supabase.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).gte('enrolled_at', todayStart),
      supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).gte('review_date', todayStart),
      supabase.from('reviews').select('rating').eq('venue_id', venueId).gte('review_date', todayStart),
    ])

    const avgRating = ratingData?.length ? +(ratingData.reduce((a, r) => a + r.rating, 0) / ratingData.length).toFixed(1) : null

    await supabase.from('kpi_snapshots').upsert({
      venue_id: venueId, date: today,
      new_members: newMembers || 0,
      reviews_received: reviewsReceived || 0,
      avg_rating: avgRating,
    }, { onConflict: 'venue_id,date' })
  }

  return NextResponse.json({ success: true, processed: venues.length, results })
}
