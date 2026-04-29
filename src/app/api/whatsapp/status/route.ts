/**
 * POST /api/whatsapp/status
 * Twilio status callback — updates message delivery status in DB.
 * Set as "Status Callback URL" in your Twilio messaging service.
 * Public (Twilio posts here, no auth header — validated by presence of MessageSid).
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

// Twilio → our status mapping
const STATUS_MAP: Record<string, string> = {
  queued:      'sent',
  sending:     'sent',
  sent:        'sent',
  delivered:   'delivered',
  read:        'read',
  failed:      'failed',
  undelivered: 'failed',
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData()
    const messageSid    = form.get('MessageSid')    as string | null
    const messageStatus = form.get('MessageStatus') as string | null

    if (!messageSid || !messageStatus) {
      return new NextResponse('Missing fields', { status: 400 })
    }

    const status = STATUS_MAP[messageStatus] ?? 'sent'

    const supabase = getAdminClient()
    await supabase
      .from('whatsapp_messages')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('twilio_sid', messageSid)

    return new NextResponse('OK', { status: 200 })
  } catch (err) {
    console.error('[whatsapp/status]', err)
    return new NextResponse('Error', { status: 500 })
  }
}
