export const dynamic = 'force-dynamic'
import { createAdminClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { PLANS } from '@/lib/stripe'
import Topbar from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import ManageSubscriptionButton from './ManageSubscriptionButton'
import Link from 'next/link'

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:   { label: 'Active',    color: 'text-[#2A9D5C] bg-[#2A9D5C]/10' },
  trialing: { label: 'Trial',     color: 'text-teal bg-teal/10' },
  past_due: { label: 'Past Due',  color: 'text-[#D4871A] bg-[#D4871A]/10' },
  canceled: { label: 'Canceled',  color: 'text-[#C0392B] bg-[#C0392B]/10' },
  trial:    { label: 'Free Trial',color: 'text-teal bg-teal/10' },
}

export default async function BillingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const admin = await createAdminClient()
  const { data: sub } = user
    ? await admin.from('subscriptions').select('*').eq('user_id', user.id).single()
    : { data: null }

  const planKey = (sub?.plan as keyof typeof PLANS) || null
  const plan = planKey ? PLANS[planKey] : null
  const statusInfo = sub ? (STATUS_LABEL[sub.status] || STATUS_LABEL['active']) : null

  const periodEnd = sub?.current_period_end
    ? new Date(sub.current_period_end).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <>
      <Topbar title="Billing" subtitle="Manage your subscription and plan" />

      <div className="flex-1 overflow-y-auto p-7 max-w-3xl">

        {/* Current Plan */}
        <div className="mb-8">
          <h2 className="font-display font-semibold text-ink text-lg mb-4">Current Plan</h2>

          {sub && plan ? (
            <Card>
              <div className="p-6">
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display font-bold text-xl text-ink">{plan.name}</span>
                      {statusInfo && (
                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      )}
                    </div>
                    <div className="text-mid text-sm">
                      €{plan.price}/month · {periodEnd ? `Renews ${periodEnd}` : 'Billed monthly'}
                    </div>
                  </div>
                  <div className="font-data text-3xl font-bold text-ink">€{plan.price}</div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-5">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2 text-[13px] text-charcoal">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2A9D5C" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20,6 9,17 4,12"/>
                      </svg>
                      {f}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-5 border-t border-[#E8E0D4]">
                  <ManageSubscriptionButton />
                  <Link
                    href="/pricing"
                    className="px-4 py-2 border border-[#E8E0D4] rounded-lg text-sm font-medium text-ink hover:bg-paper transition-colors"
                  >
                    Change Plan
                  </Link>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="font-display font-bold text-xl text-ink">Free Trial</span>
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full text-teal bg-teal/10">Active</span>
                    </div>
                    <p className="text-mid text-sm">Explore the platform. Upgrade anytime to unlock full access.</p>
                  </div>
                </div>
                <Link
                  href="/pricing"
                  className="inline-block bg-ember text-white font-semibold px-5 py-2.5 rounded-xl text-sm hover:opacity-90 transition-opacity"
                >
                  Upgrade Now →
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Plan Comparison */}
        <div>
          <h2 className="font-display font-semibold text-ink text-lg mb-4">All Plans</h2>
          <div className="grid grid-cols-3 gap-4">
            {(Object.entries(PLANS) as [keyof typeof PLANS, typeof PLANS[keyof typeof PLANS]][]).map(([key, p]) => (
              <div
                key={key}
                className={`rounded-xl border p-4 ${
                  planKey === key
                    ? 'border-ember/40 bg-ember/5 ring-1 ring-ember/20'
                    : 'border-[#E8E0D4] bg-white'
                }`}
              >
                <div className="text-xs font-semibold uppercase tracking-[0.15em] text-mid mb-2">{p.name}</div>
                <div className="font-data text-2xl font-bold text-ink mb-3">€{p.price}<span className="text-sm font-normal text-mid">/mo</span></div>
                {planKey === key ? (
                  <span className="text-[11px] font-semibold text-ember">Current plan</span>
                ) : (
                  <Link href="/pricing" className="text-[11px] font-semibold text-teal hover:underline">
                    Switch →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Billing info note */}
        <div className="mt-8 bg-paper border border-[#E8E0D4] rounded-xl p-4">
          <p className="text-[12px] text-mid">
            💳 Payments are processed securely by <strong>Stripe</strong>. To update your payment method, cancel, or view invoices — click <strong>Manage Subscription</strong> above.
          </p>
        </div>
      </div>
    </>
  )
}
