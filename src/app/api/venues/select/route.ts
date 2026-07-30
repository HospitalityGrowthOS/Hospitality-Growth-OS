import { NextRequest, NextResponse } from 'next/server'
import { ownsVenue, SELECTED_VENUE_COOKIE } from '@/lib/venue'

/**
 * Switches which venue the dashboard is showing.
 *
 * A route handler rather than a server action because setting a cookie is not
 * permitted from a server component, and the selection has to outlive the
 * request that made it.
 */
export async function POST(req: NextRequest) {
  try {
    const { venue_id } = await req.json()
    if (typeof venue_id !== 'string' || !venue_id) {
      return NextResponse.json({ error: 'venue_id is required' }, { status: 400 })
    }

    // Ownership is verified server-side. A client asking for someone else's
    // venue is refused rather than trusted.
    if (!(await ownsVenue(venue_id))) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const res = NextResponse.json({ success: true, venue_id })
    res.cookies.set(SELECTED_VENUE_COOKIE, venue_id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
    return res
  } catch (err) {
    console.error('[venues/select] failed:', err)
    return NextResponse.json({ error: 'Could not switch venue' }, { status: 500 })
  }
}
