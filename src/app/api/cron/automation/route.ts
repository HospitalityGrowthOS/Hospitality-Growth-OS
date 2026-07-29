import { NextRequest, NextResponse } from 'next/server'
import { drain } from '@/lib/automation'

/**
 * Drains scheduled automation work that has become due.
 *
 * The only thing that invokes the scheduler. Swapping this for pg_cron or a
 * queue worker later changes nothing about how workflows are defined — the
 * drain function is the contract, not this route.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const result = await drain()
    return NextResponse.json({ success: true, ...result })
  } catch (err) {
    console.error('[cron/automation] drain failed:', err)
    return NextResponse.json({ error: 'Drain failed' }, { status: 500 })
  }
}

/**
 * pg_cron calls this via net.http_post, mirroring the review dispatcher.
 * pg_net's http_get was observed dropping the Authorization header (401 on
 * every call while http_post authenticated fine), so POST is the verb the
 * database uses; GET remains for Vercel's daily cron and manual checks.
 */
export const POST = GET
