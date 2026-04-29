export const dynamic = 'force-dynamic'
import { getCurrentVenue } from '@/lib/venue'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import Link from 'next/link'
import QRCode from 'qrcode'

export default async function VenueQRPage() {
  const venue = await getCurrentVenue()

  if (!venue) {
    return (
      <>
        <Topbar title="Signup QR Code" subtitle="No venue found" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-mid text-sm">No venue linked to your account.</p>
        </div>
      </>
    )
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001'
  const signupUrl = `${appUrl}/signup/${venue.id}`

  const qrDataUrl = await QRCode.toDataURL(signupUrl, {
    width: 300,
    margin: 3,
    color: { dark: '#1A1510', light: '#FFFFFF' },
    errorCorrectionLevel: 'H',
  })

  return (
    <>
      <Topbar
        title="Signup QR Code"
        subtitle="Display at your venue so guests can scan and join your loyalty programme"
        actions={
          <Link
            href="/dashboard/loyalty"
            className="px-4 py-2 border border-[#E8E0D4] rounded-lg text-sm font-medium text-ink hover:bg-paper transition-colors"
          >
            ← Members
          </Link>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        <div className="grid grid-cols-[auto_1fr] gap-6 max-w-3xl">

          {/* QR Card — printable area */}
          <Card>
            <div className="p-6 flex flex-col items-center w-72">

              {/* Mini brand */}
              <div className="flex items-center gap-2 mb-5">
                <svg width="22" height="22" viewBox="0 0 56 56" fill="none">
                  <rect width="56" height="56" rx="10" fill="#E85D26"/>
                  <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
                  <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
                  <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
                  <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
                </svg>
                <span className="font-display text-[13px] font-semibold text-ink">Loyalty</span>
              </div>

              {/* QR image */}
              <div className="bg-white border border-[#E8E0D4] rounded-xl p-4 mb-5 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrDataUrl}
                  alt={`${venue.name} loyalty signup QR`}
                  width={200}
                  height={200}
                  className="rounded-lg"
                />
              </div>

              <div className="text-center mb-4">
                <div className="font-display font-bold text-ink text-base mb-1">{venue.name}</div>
                <div className="text-[12px] text-mid">Scan to join our loyalty programme</div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  {[
                    { emoji: '🎁', label: '50 welcome pts' },
                    { emoji: '⭐', label: 'Earn on visits' },
                    { emoji: '🥇', label: 'Gold rewards' },
                  ].map(({ emoji, label }) => (
                    <div key={label} className="text-center">
                      <div className="text-base">{emoji}</div>
                      <div className="text-[9px] text-mid mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-paper rounded-lg px-2.5 py-1.5 text-[9px] font-data text-mid text-center break-all w-full">
                {signupUrl}
              </div>
            </div>
          </Card>

          {/* Right panel */}
          <div className="flex flex-col gap-4">

            {/* Instructions */}
            <Card>
              <div className="p-5">
                <div className="font-display font-semibold text-ink text-base mb-4">How to deploy</div>
                <div className="flex flex-col gap-3.5">
                  {[
                    { step: '1', text: 'Download the QR code image below' },
                    { step: '2', text: 'Print and laminate it — place at counter, tables, or entrance' },
                    { step: '3', text: 'Guests scan with their phone camera — no app needed' },
                    { step: '4', text: 'They enroll in 20 seconds and receive 50 welcome points' },
                    { step: '5', text: 'They appear in your Loyalty Members dashboard instantly' },
                  ].map(({ step, text }) => (
                    <div key={step} className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-ember flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                        {step}
                      </div>
                      <p className="text-[13px] text-charcoal leading-snug">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card>

            {/* Direct link copy */}
            <Card>
              <div className="p-5">
                <div className="font-display font-semibold text-ink mb-1">Direct Link</div>
                <p className="text-[12px] text-mid mb-3">Share via WhatsApp, Instagram, or email to enroll guests remotely</p>
                <div className="bg-paper border border-[#E8E0D4] rounded-lg px-3 py-2.5 text-[11px] font-data text-charcoal break-all">
                  {signupUrl}
                </div>
              </div>
            </Card>

            {/* Download button */}
            <a
              href={qrDataUrl}
              download={`${(venue.name || 'venue').toLowerCase().replace(/\s+/g, '-')}-loyalty-qr.png`}
              className="flex items-center justify-center gap-2 bg-ember text-white font-semibold py-3.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
            >
              ↓ &nbsp;Download QR Code PNG
            </a>

            {/* Tier reminder */}
            <div className="bg-paper border border-[#E8E0D4] rounded-xl p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mid mb-2">Current Tier Structure</div>
              <div className="flex flex-col gap-1.5">
                {[
                  { emoji: '🥉', tier: 'Bronze', range: '0 – 499 pts',   perk: 'Welcome bonus + QR access' },
                  { emoji: '🥈', tier: 'Silver', range: '500 – 1,499 pts', perk: '10% discount + priority' },
                  { emoji: '🥇', tier: 'Gold',   range: '1,500+ pts',    perk: 'Free dessert + 2× points' },
                ].map(({ emoji, tier, range, perk }) => (
                  <div key={tier} className="flex items-center gap-2.5">
                    <span className="text-sm">{emoji}</span>
                    <div>
                      <span className="text-[12px] font-medium text-ink">{tier}</span>
                      <span className="text-[11px] text-mid"> · {range} · {perk}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}
