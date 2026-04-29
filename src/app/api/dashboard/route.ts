/**
 * Dashboard Data API
 * Returns all KPIs, recent activity, AI recommendations for the owner dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const admin = await createAdminClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('venue_id').eq('id', user.id).single()
  if (!profile?.venue_id) return NextResponse.json({ error: 'No venue found' }, { status: 404 })

  const venueId = profile.venue_id
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: totalMembers },
    { count: newMembersWeek },
    { data: reviewStats },
    { data: pendingReviews },
    { data: aiRecs },
    { data: actionItems },
    { data: recentActivity },
    { data: campaignStats },
    { data: kpiHistory },
  ] = await Promise.all([
    admin.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId),
    admin.from('loyalty_members').select('*', { count: 'exact', head: true }).eq('venue_id', venueId).gte('enrolled_at', sevenDaysAgo),
    admin.from('reviews').select('rating').eq('venue_id', venueId).gte('review_date', thirtyDaysAgo),
    admin.from('reviews').select('*').eq('venue_id', venueId).eq('status', 'pending').order('review_date', { ascending: false }).limit(5),
    admin.from('ai_recommendations').select('*').eq('venue_id', venueId).eq('status', 'pending').order('generated_at', { ascending: false }).limit(5),
    admin.from('action_items').select('*').eq('venue_id', venueId).eq('status', 'pending').order('created_at', { ascending: false }).limit(8),
    admin.from('analytics_events').select('*').eq('venue_id', venueId).order('created_at', { ascending: false }).limit(10),
    admin.from('campaigns').select('sent_count, opened_count, converted_count').eq('venue_id', venueId).eq('status', 'completed').gte('created_at', thirtyDaysAgo),
    admin.from('kpi_snapshots').select('*').eq('venue_id', venueId).order('date', { ascending: false }).limit(30),
  ])

  const avgRating = reviewStats?.length
    ? +(reviewStats.reduce((a, r) => a + r.rating, 0) / reviewStats.length).toFixed(1)
    : null

  const totalCampaignSends = campaignStats?.reduce((a, c) => a + (c.sent_count || 0), 0) || 0
  const totalCampaignOpens = campaignStats?.reduce((a, c) => a + (c.opened_count || 0), 0) || 0
  const openRate = totalCampaignSends > 0 ? +((totalCampaignOpens / totalCampaignSends) * 100).toFixed(1) : 0

  return NextResponse.json({
    kpis: {
      total_members: totalMembers || 0,
      new_members_this_week: newMembersWeek || 0,
      avg_rating: avgRating,
      open_rate: openRate,
    },
    pending_reviews: pendingReviews || [],
    ai_recommendations: aiRecs || [],
    action_items: actionItems || [],
    recent_activity: recentActivity || [],
    kpi_history: kpiHistory || [],
  })
}
