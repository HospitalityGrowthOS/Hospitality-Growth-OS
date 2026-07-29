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
