import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-ink text-paper font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/[0.07] sticky top-0 bg-ink/95 backdrop-blur-sm z-50">
        <div className="flex items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 56 56" fill="none">
            <rect width="56" height="56" rx="8" fill="#E85D26"/>
            <rect x="11" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="37" y="13" width="8" height="30" rx="1" fill="white"/>
            <rect x="11" y="24" width="34" height="8" rx="1" fill="#1A1510"/>
            <path d="M38 8L48 8L48 18" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M35 13L48 8" stroke="#C8A45A" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
          <div>
            <div className="font-display font-semibold text-[16px] text-paper leading-tight">Hospitality Growth</div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-mid">AI Revenue Platform</div>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-8">
          {['Features', 'Pricing', 'About'].map(l => (
            <a key={l} href={`#${l.toLowerCase()}`} className="text-[13px] text-mid hover:text-paper transition-colors">{l}</a>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-[13px] text-mid hover:text-paper transition-colors">Sign in</Link>
          <Link href="/login" className="bg-ember hover:bg-ember/90 text-white text-[13px] font-semibold px-4 py-2 rounded-lg transition-colors">
            Start free trial
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative px-8 pt-28 pb-32 text-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(232,93,38,0.12)_0%,_transparent_60%)] pointer-events-none"/>

        <div className="inline-flex items-center gap-2 bg-white/[0.06] border border-white/[0.1] rounded-full px-4 py-1.5 text-[12px] text-mid mb-8">
          <span className="w-1.5 h-1.5 bg-ember rounded-full animate-pulse"/>
          Now live in Cologne &amp; Toronto · Join 120+ restaurants
        </div>

        <h1 className="font-display text-[68px] font-semibold text-paper leading-[1.05] tracking-tight max-w-4xl mx-auto mb-6">
          Turn every guest into{' '}
          <span className="text-ember">revenue.</span>
        </h1>

        <p className="text-[18px] text-mid max-w-2xl mx-auto mb-10 leading-relaxed">
          AI-powered loyalty, review automation, and guest intelligence for independent restaurants, cafés, and hotels. Increase repeat visits by 40% in 90 days.
        </p>

        <div className="flex items-center justify-center gap-4">
          <Link href="/login" className="bg-ember hover:bg-ember/90 text-white font-semibold px-7 py-3.5 rounded-xl text-[15px] transition-all hover:shadow-[0_4px_20px_rgba(232,93,38,0.4)]">
            Get started free — no card needed
          </Link>
          <a href="#features" className="flex items-center gap-2 text-mid hover:text-paper text-[14px] transition-colors">
            See how it works
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6,9 12,15 18,9"/></svg>
          </a>
        </div>

        <div className="flex items-center justify-center gap-8 mt-14 pt-10 border-t border-white/[0.07]">
          {[
            { value: '847', label: 'Loyalty members / venue' },
            { value: '4.8★', label: 'Avg Google rating lift' },
            { value: '+40%', label: 'Repeat visit rate' },
            { value: '€4,200', label: 'Monthly revenue impact' },
          ].map(({ value, label }) => (
            <div key={label} className="text-center">
              <div className="font-data text-3xl font-bold text-paper">{value}</div>
              <div className="text-[11px] text-mid mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-8 py-24 bg-white/[0.02] border-t border-white/[0.07]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember mb-3">Everything you need</div>
            <h2 className="font-display text-[48px] font-semibold text-paper leading-tight">One platform. Full growth stack.</h2>
            <p className="text-mid text-[16px] mt-4 max-w-2xl mx-auto">Replace 5 separate tools with one AI-native system built for hospitality.</p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {[
              { icon: '⭐', color: 'bg-gold/10 border-gold/20', iconBg: 'bg-gold/10', title: 'Review Automation', desc: 'WhatsApp review requests 45 minutes after every visit. AI drafts personalised responses. Negative reviews handled privately.', stat: '+0.6★ avg rating in 60 days' },
              { icon: '🎁', color: 'bg-ember/10 border-ember/20', iconBg: 'bg-ember/10', title: 'QR Loyalty Programme', desc: 'Guests enrol in 20 seconds via QR code. Bronze, Silver, Gold tiers with automated upgrades, points, and reward redemptions.', stat: '3.2× spend from loyalty members' },
              { icon: '🤖', color: 'bg-teal/10 border-teal/20', iconBg: 'bg-teal/10', title: 'AI Guest Assistant', desc: '24/7 WhatsApp, Instagram, and website chat. Handles bookings, FAQs, menus. Escalates to you when needed.', stat: '94% queries resolved automatically' },
              { icon: '📣', color: 'bg-[#2A9D5C]/10 border-[#2A9D5C]/20', iconBg: 'bg-[#2A9D5C]/10', title: 'WhatsApp Campaigns', desc: 'Send personalised campaigns to segmented guest lists. Win-back inactive guests. Birthday surprises. Tier upgrade nudges.', stat: '71% avg open rate vs 22% email' },
              { icon: '📊', color: 'bg-ember/10 border-ember/20', iconBg: 'bg-ember/10', title: 'Growth Intelligence', desc: 'AI analyses your data weekly. Recommends which guests to target, when to launch campaigns, and what drives revenue.', stat: 'Weekly AI report every Monday' },
              { icon: '👥', color: 'bg-gold/10 border-gold/20', iconBg: 'bg-gold/10', title: 'Guest CRM', desc: 'Full profiles: visit history, spend, tier, tags, communication history. Know every guest name before they sit down.', stat: '1,284 avg profiles per venue' },
            ].map(({ icon, color, iconBg, title, desc, stat }) => (
              <div key={title} className={`bg-white/[0.03] border ${color} rounded-2xl p-6 hover:bg-white/[0.05] transition-colors`}>
                <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center text-xl mb-4`}>{icon}</div>
                <h3 className="font-display font-semibold text-paper text-[18px] mb-2">{title}</h3>
                <p className="text-mid text-[13px] leading-relaxed mb-4">{desc}</p>
                <div className="flex items-center gap-1.5 text-[11px] text-[#2A9D5C]">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18,15 12,9 6,15"/></svg>
                  {stat}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-8 py-24 border-t border-white/[0.07]">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-ember mb-3">Simple pricing</div>
            <h2 className="font-display text-[48px] font-semibold text-paper">Pay for results, not complexity.</h2>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {[
              {
                name: 'Starter', price: '€199', period: '/month',
                desc: 'Get your first loyalty members and automate reviews.',
                features: ['Review Automation', 'QR Loyalty Programme', 'Guest CRM (up to 500)', 'WhatsApp templates', 'Email support'],
                cta: 'Start free trial', featured: false,
              },
              {
                name: 'Growth', price: '€499', period: '/month',
                desc: 'The full AI revenue platform for serious operators.',
                features: ['Everything in Starter', 'AI Guest Assistant', 'WhatsApp Campaigns', 'Growth Intelligence', 'Unlimited guest CRM', 'Priority support'],
                cta: 'Start free trial', featured: true,
              },
              {
                name: 'Scale', price: '€1,199', period: '/month',
                desc: 'Multi-venue groups and hotel chains.',
                features: ['Everything in Growth', 'Up to 10 venues', 'Centralised analytics', 'Dedicated account manager', 'Custom integrations', 'SLA guarantee'],
                cta: 'Contact us', featured: false,
              },
            ].map(({ name, price, period, desc, features, cta, featured }) => (
              <div key={name} className={`rounded-2xl p-7 ${featured ? 'bg-ember border border-ember/60 shadow-[0_4px_30px_rgba(232,93,38,0.3)]' : 'bg-white/[0.04] border border-white/[0.1]'}`}>
                {featured && <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70 mb-3">Most Popular</div>}
                <div className="font-display font-semibold text-[20px] text-paper mb-1">{name}</div>
                <div className="flex items-end gap-1 mb-3">
                  <span className="font-data text-[42px] font-bold text-paper leading-none">{price}</span>
                  <span className="text-mid text-[14px] mb-2">{period}</span>
                </div>
                <p className={`text-[13px] mb-5 leading-relaxed ${featured ? 'text-white/70' : 'text-mid'}`}>{desc}</p>
                <div className="flex flex-col gap-2 mb-6">
                  {features.map(f => (
                    <div key={f} className={`flex items-center gap-2 text-[13px] ${featured ? 'text-white' : 'text-mid'}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={featured ? 'white' : '#2A9D5C'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                      {f}
                    </div>
                  ))}
                </div>
                <Link href="/login" className={`block text-center py-3 rounded-xl text-[14px] font-semibold transition-colors ${featured ? 'bg-white text-ember hover:bg-paper' : 'bg-white/[0.07] text-paper hover:bg-white/[0.12] border border-white/[0.1]'}`}>
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-24 border-t border-white/[0.07] text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="font-display text-[52px] font-semibold text-paper leading-tight mb-5">Ready to grow?</h2>
          <p className="text-mid text-[17px] leading-relaxed mb-8">
            Join 120+ restaurants already using Hospitality Growth OS to build loyal guest communities and increase revenue.
          </p>
          <Link href="/login" className="inline-block bg-ember hover:bg-ember/90 text-white font-semibold px-8 py-4 rounded-xl text-[16px] transition-all hover:shadow-[0_4px_24px_rgba(232,93,38,0.45)]">
            Start your free 14-day trial
          </Link>
          <p className="text-[12px] text-mid mt-4">No credit card required · Setup in 10 minutes · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-8 py-8 border-t border-white/[0.07] flex items-center justify-between">
        <div className="text-[12px] text-mid">© 2026 Hospitality Growth OS · Cologne &amp; Toronto</div>
        <div className="text-[12px] text-mid">Turn every guest into revenue.</div>
      </footer>
    </div>
  )
}
