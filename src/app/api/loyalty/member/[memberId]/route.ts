/**
 * GET /api/loyalty/member/[memberId]
 * Public endpoint — no auth required.
 * Returns member data + recent transactions for the customer loyalty card.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const supabase = getAdminClient()

  const [{ data: member }, { data: transactions }] = await Promise.all([
    supabase
      .from('loyalty_members')
      .select('*, guests(name, phone)')
      .eq('id', params.memberId)
      .single(),
    supabase
      .from('loyalty_transactions')
      .select('id, type, points, description, created_at')
      .eq('member_id', params.memberId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!member) {
    return NextResponse.json({ error: 'Member not found' }, { status: 404 })
  }

  // Fetch venue name separately (avoids FK join dependency)
  const { data: venue } = await supabase
    .from('venues')
    .select('name, city')
    .eq('id', member.venue_id)
    .single()

  return NextResponse.json({
    member: {
      ...member,
      venue_name: venue?.name || null,
      venue_city: venue?.city || null,
    },
    transactions: transactions || [],
  })
}
