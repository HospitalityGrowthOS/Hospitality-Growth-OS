import Topbar from '@/components/layout/Topbar'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

const steps = [
  {
    id: 1,
    title: 'Connect your WhatsApp Business number',
    desc: 'Register your venue\'s WhatsApp Business Account via Meta Business Manager. This is the number guests receive messages from.',
    done: true,
    required: true,
    cta: 'Reconnect',
    ctaVariant: 'ghost' as const,
  },
  {
    id: 2,
    title: 'Set up your loyalty programme',
    desc: 'Define your tier thresholds, points per euro, and welcome bonus. Takes 2 minutes.',
    done: true,
    required: true,
    cta: 'Edit settings',
    ctaVariant: 'ghost' as const,
  },
  {
    id: 3,
    title: 'Print your QR signup cards',
    desc: 'Download your branded QR code PDF and place it on tables. Guests scan to enrol in 20 seconds.',
    done: true,
    required: true,
    cta: 'Download PDF',
    ctaVariant: 'ghost' as const,
  },
  {
    id: 4,
    title: 'Customise your review request message',
    desc: 'Edit the WhatsApp message sent 45 minutes after each visit. Add your venue name and a personal touch.',
    done: false,
    required: true,
    cta: 'Edit message',
    ctaVariant: 'secondary' as const,
  },
  {
    id: 5,
    title: 'Import existing guests (optional)',
    desc: 'Upload a CSV of existing guests to pre-populate your CRM and give them welcome points.',
    done: false,
    required: false,
    cta: 'Upload CSV',
    ctaVariant: 'secondary' as const,
  },
  {
    id: 6,
    title: 'Launch your first campaign',
    desc: 'Send a welcome campaign to announce your new loyalty programme. AI can write it for you.',
    done: false,
    required: false,
    cta: 'Create campaign',
    ctaVariant: 'secondary' as const,
  },
  {
    id: 7,
    title: 'Configure AI Guest Assistant',
    desc: 'Train the AI on your menu, hours, FAQs, and booking process. It handles WhatsApp/Instagram 24/7.',
    done: false,
    required: false,
    cta: 'Set up AI',
    ctaVariant: 'secondary' as const,
  },
]

const completed = steps.filter(s => s.done).length
const pct = Math.round((completed / steps.length) * 100)

export default function OnboardingPage() {
  return (
    <>
      <Topbar
        title="Onboarding"
        subtitle="Get your Growth OS fully set up"
        actions={
          <Badge variant={pct === 100 ? 'success' : 'warning'}>
            {completed}/{steps.length} complete
          </Badge>
        }
      />

      <div className="flex-1 overflow-y-auto p-7">
        {/* Progress bar */}
        <Card className="mb-6">
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="font-display font-semibold text-ink text-base">Setup Progress</div>
                <div className="text-[12px] text-mid mt-0.5">Complete all required steps to go live</div>
              </div>
              <div className="font-data text-3xl font-bold text-ink">{pct}%</div>
            </div>
            <div className="h-2 bg-paper rounded-full overflow-hidden">
              <div className="h-full bg-ember rounded-full transition-all" style={{ width: `${pct}%` }}/>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <span className="text-[11px] text-[#2A9D5C] flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                {completed} done
              </span>
              <span className="text-[11px] text-mid">{steps.length - completed} remaining</span>
              {pct >= 57 && (
                <span className="ml-auto text-[11px] bg-[#2A9D5C]/10 text-[#2A9D5C] px-2.5 py-0.5 rounded-full font-medium">
                  Ready to go live — required steps done ✓
                </span>
              )}
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-[1fr_280px] gap-4">
          {/* Steps */}
          <div className="flex flex-col gap-3">
            {steps.map((step) => (
              <div
                key={step.id}
                className={`bg-white border rounded-xl p-4 flex items-start gap-3.5 transition-all ${step.done ? 'border-[#2A9D5C]/30 bg-[#2A9D5C]/[0.02]' : 'border-[#E8E0D4] hover:border-ember/30'}`}
              >
                {/* Check */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border-2 ${step.done ? 'bg-[#2A9D5C] border-[#2A9D5C]' : 'border-[#E8E0D4] bg-paper'}`}>
                  {step.done ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                  ) : (
                    <span className="font-data text-[11px] font-bold text-mid">{step.id}</span>
                  )}
                </div>

                {/* Content */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[13px] font-medium ${step.done ? 'text-mid line-through' : 'text-ink'}`}>{step.title}</span>
                    {step.required && !step.done && (
                      <span className="text-[10px] bg-ember/10 text-ember px-1.5 py-0.5 rounded font-semibold">Required</span>
                    )}
                    {!step.required && (
                      <span className="text-[10px] text-mid px-1.5 py-0.5 rounded border border-[#E8E0D4]">Optional</span>
                    )}
                  </div>
                  <p className="text-[12px] text-mid leading-relaxed">{step.desc}</p>
                </div>

                <Button size="sm" variant={step.ctaVariant} className="flex-shrink-0 text-[11px]">
                  {step.cta}
                </Button>
              </div>
            ))}
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">
            {/* Help */}
            <Card>
              <CardHeader>
                <div className="font-display font-semibold text-ink text-base">Need help?</div>
              </CardHeader>
              <CardBody className="flex flex-col gap-2.5">
                <a href="#" className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-paper transition-colors border border-transparent hover:border-[#E8E0D4]">
                  <div className="w-8 h-8 rounded-lg bg-teal/10 flex items-center justify-center text-sm flex-shrink-0">📖</div>
                  <div>
                    <div className="text-[12px] font-medium text-ink">Setup guide</div>
                    <div className="text-[11px] text-mid">Step-by-step docs</div>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-paper transition-colors border border-transparent hover:border-[#E8E0D4]">
                  <div className="w-8 h-8 rounded-lg bg-ember/10 flex items-center justify-center text-sm flex-shrink-0">💬</div>
                  <div>
                    <div className="text-[12px] font-medium text-ink">Live chat support</div>
                    <div className="text-[11px] text-mid">Response in &lt;2 hours</div>
                  </div>
                </a>
                <a href="#" className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-paper transition-colors border border-transparent hover:border-[#E8E0D4]">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center text-sm flex-shrink-0">🎥</div>
                  <div>
                    <div className="text-[12px] font-medium text-ink">Video walkthrough</div>
                    <div className="text-[11px] text-mid">12-minute overview</div>
                  </div>
                </a>
              </CardBody>
            </Card>

            {/* Account details */}
            <Card>
              <CardHeader>
                <div className="font-display font-semibold text-ink text-base">Your Plan</div>
              </CardHeader>
              <CardBody>
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-9 h-9 rounded-md bg-gradient-to-br from-ember to-[#c44d1a] flex items-center justify-center text-white text-xs font-bold font-display flex-shrink-0">RM</div>
                  <div>
                    <div className="text-[13px] font-semibold text-ink">Ristorante Milano</div>
                    <div className="text-[10px] text-gold uppercase tracking-[0.1em] font-semibold">Growth · €499/mo</div>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  {['Review Automation', 'QR Loyalty', 'AI Guest Assistant', 'CRM Dashboard', 'WhatsApp Campaigns', 'Growth Intelligence'].map(f => (
                    <div key={f} className="flex items-center gap-2 text-[12px] text-charcoal">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <Button size="sm" variant="secondary" className="w-full mt-4">Manage subscription</Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
}
