# Hospitality Growth OS — Roadmap & Development Strategy

> **Living document.** Chapters 30–33 are the frozen Architecture Bible; this file changes weekly.
> It lives in the repository, beside the code it describes, and is versioned with it.
>
> **Last measured: 30 July 2026.** Every number below was taken from the codebase and the
> production database on that date. Treat anything older than a fortnight as stale.

---

## 1. Mission

Build the leading **AI Growth Platform for Hospitality**.

The objective is not to replace every operational system a venue runs. The objective is to become
the **intelligence, automation and growth layer that sits above them**.

Every roadmap decision should move HGOS closer to that. A proposal that does not is either
premature or belongs to a different company.

---

## 2. Status — measured, not estimated

**Engineering**

| Metric | Value |
|---|---|
| TypeScript files / lines | 151 / 21,275 |
| API routes / pages | 27 / 39 |
| Business logic in service layers | 5,521 lines (AI 1,255 · Intelligence 1,753 · Automation 2,513) |
| TypeScript errors | **0** |
| `ignoreBuildErrors` | removed |
| Unguarded database writes | **0** (was 32) |
| Production deployment | live, verified end to end |

**Actual usage — the uncomfortable half**

| Table | Rows | Reading |
|---|---|---|
| `kpi_snapshots` | 111 | the daily cron has run faithfully for months |
| `guests` | 14 | ~11 real signups from April–May |
| `visits` | **4** | all four created during internal verification |
| `reviews` | **0** | never held a row |
| `campaigns` | **0** | never used |
| `weekly_reports` | **0** | never successfully generated |
| Stripe mode | **test** | the platform cannot take real money today |

**The one sentence that matters:** a retention platform whose retention loop has never closed for a
real guest. Every risk engineering could retire has been retired. The remaining risk is whether
anyone will pay.

---

## 3. What HGOS Is — three tiers, stated once

| Tier | Contents | Maturity | Status |
|---|---|---|---|
| **Current Commercial Product**<br>*AI Growth Platform* | CRM · Loyalty · Reviews · WhatsApp AI · Campaigns · Growth Intelligence · Automation Engine · AI Command Center | **~85%** | **This is what we sell.** |
| **Current Development Product**<br>*Restaurant Module* | Smart Menu · QR Ordering · Reservations · Tables · Kitchen · AI Waiter | **~25%** | Designed (Ch 30–31), not built. **Pending customer evidence.** |
| **Future Platform**<br>*Universal Hospitality OS* | Platform Framework · Capability Registry · Demo Factory · Hotel, Retail, Healthcare modules | **architecture only** | Designed (Ch 32–33). Deliberately unbuilt. |

**Positioning line:** *AI Growth Platform for Hospitality.* Not a POS. Not a Restaurant Operating
System. When someone asks what HGOS does, the answer is that it grows revenue from the guests a
venue already has — not that it takes their orders.

---

## 4. Current Phase & Next Actions

**Phase: pre-revenue. Objective: one restaurant using the product.**

| # | Action | Owner | Notes |
|---|---|---|---|
| 1 | Ask a *Steuerberater* what registering the business costs and takes | Founder | Unblocks Meta **and** Stripe live **and** contracts. Highest leverage item on this page |
| 2 | Purge internal test data from production | Eng | Skews every metric today |
| 3 | Verify Resend domain (DNS records only) | Founder | ~30 min. No entity required |
| 4 | Email as a working channel | Eng | ~1.5 days. Fallback, **not** a repositioning |
| 5 | Multi-venue support (`.single()` limit) | Eng | Blocks the Golden Demo Venue — see debt register |
| 6 | Golden Demo Venue | Eng | One handcrafted restaurant. **Not** the Demo Factory |
| 7 | Review landing / pricing / onboarding / billing | Both | Mostly already built |
| 8 | Talk to ten restaurants | Founder | Costs nothing. Not blocked by anything |
| 9 | One free pilot | Founder | No entity, no Stripe, no Meta needed |

**Channel reality while Meta is pending:** owner alerts over WhatsApp (their number fits Meta's
5-number test allowlist); guest messaging over email. WhatsApp returns as primary once verification
completes.

---

## 5. Feature Priorities

### P0 — must exist before customer #1

- Email channel working end to end
- Production data clean
- Multi-venue support
- Golden Demo Venue
- Onboarding walked by a human who is not the developer
- Business entity → Stripe live mode

### P1 — must exist before customer #10

- Meta verification; WhatsApp restored as primary channel
- Weekly reports actually generating
- Campaign sending exercised with real recipients
- Mobile responsiveness verified on real devices
- **Smart Menu / QR Ordering / Reservations — only if prospects ask.** See §7

### P2 — must exist before customer #100

- Demo Factory (Ch 33) implemented properly
- Platform Framework extracted (Ch 32)
- Aggregation layer for event volume (Ch 31 §12)
- Multi-user access per venue
- POS integration, chosen by a named customer's actual system

---

## 6. Success Metrics

Targets marked *(hypothesis)* are guesses to be replaced by observation. Recording them now makes
them falsifiable later.

**Product health — measurable today**

| Metric | Now | Target |
|---|---|---|
| Review request → response rate | — | 25% *(hypothesis)* |
| Guests enrolled in loyalty per venue per month | — | 40 *(hypothesis)* |
| Automation execution success rate | 100% (n=2) | >98% at n>100 |
| AI request success rate | 81% | >98% |
| Recommendations acted on per venue per month | 0 | ≥1 |

**Commercial**

| Metric | Now | Next milestone |
|---|---|---|
| Pilot venues | 0 | 1 |
| Paying venues | 0 | 1, then 10 |
| MRR | €0 | first euro |
| Pilot → paid conversion | — | ≥50% *(hypothesis)* |

**The metric that matters most right now:** number of restaurants that have *used* the product.
It is currently zero, and no engineering metric compensates for that.

---

## 7. Customer Feedback Rules

The rules that stop feedback being read as confirmation of what we already wanted to build.

1. **Ask before building.** Any feature above a few days' work needs evidence from at least three
   prospects who raised it *unprompted*.
2. **Pre-commit to the threshold.** Decide what would change the decision *before* asking. "If three
   of five raise ordering unprompted, we build Smart Menu." Deciding afterwards is rationalising.
3. **Unprompted beats prompted.** "Would you like QR ordering?" gets a yes from almost everyone.
   What they raise themselves, before we mention it, is the signal.
4. **Watch behaviour over words.** A venue that says loyalty matters but never opens the loyalty page
   has told us something truer than the interview did.
5. **A request is data about a problem, not a specification.** "We need a waitlist" may mean
   "Fridays are chaotic." Solve the problem, which is often cheaper.
6. **One customer is not a market.** One venue's request is an anecdote. Three independent ones is a
   pattern.
7. **Record every conversation in the decision log**, including the ones that contradict the plan.
   Especially those.
8. **Chapter 32's law governs feature requests too.** If a venue asks us to replace an entrenched
   incumbent, the default answer is integration, not replacement.

---

## 8. Definition of Done

A phase or feature is complete only when **all** of these are true:

- [ ] **Implemented** — code merged, zero TypeScript errors, every write guarded
- [ ] **Tested** — verified against the live database, not only typechecked
- [ ] **Documented** — behaviour and its constraints written down where the next person will look
- [ ] **Demonstrated** — shown working end to end, ideally in a screenshot or recording
- [ ] **Used by a real customer** — where applicable

The last box is the one that has never been ticked. Until there is a customer, it is marked *N/A*
rather than quietly dropped — the distinction keeps it visible.

**Corollary:** a green build is not "done." Every significant defect this platform has had —
the silent write failures, the loyalty double-count, the cron abort, the empty cron secret — passed
its typecheck and shipped. Only execution against real data found them.

---

## 9. Technical Debt Register

Each item records **why** it was deferred and **what ends the deferral**, so nothing rots silently.

| Item | Why deferred | Trigger |
|---|---|---|
| **Multi-venue support** (`.single()` in `venue.ts`) | One venue per owner was sufficient | **Imminent** — the Golden Demo Venue needs a second venue |
| Capability Registry implementation (ADR 0001) | One industry module — nothing to dispatch between | Second Industry Module |
| Identity resolution (Ch 32 §12) | Phone-as-key is correct for hospitality today | Hotels supplying booking references and PMS ids |
| Recurring scheduler (Automation) | Needs a recurrence cursor; stored but not executed | A workflow that genuinely needs repetition |
| Retry policy | Stored on workflows, not yet applied | First production retry need |
| Provider resolution (Ch 32 §10.4) | No second provider exists | Resort — three booking providers in one venue |
| Email provider action | Placeholder in the automation registry | Now — P0 |
| Aggregation layer (Ch 31 §12) | Event volume is trivial today | Smart Menu, or first high-volume venue |
| POS integration | No named customer, no chosen system | A paying customer's actual POS |
| `review_automation.sql` `ALTER DATABASE` trap | Known to fail on Supabase; cost hours once already | Next time that file is touched |
| Test data in production | — | **Now** — P0 |

---

## 10. Architecture Freeze

**Chapters 30–33 are frozen.** Corrections only; no new architecture chapters until there is a
paying customer.

| Chapter | Subject | Status |
|---|---|---|
| 30 | Smart Menu & AI Ordering Platform | Frozen |
| 31 | Smart Menu Platform Extension | Frozen |
| 32 | Core Platform & Industry Module Framework | Frozen |
| 33 | Demo Factory — Business Simulation Platform | Frozen |
| ADR 0001 | Capability Registry | Accepted, unimplemented by design |

This file is the successor to what would have been Chapter 34. It is markdown in git rather than a
bible chapter because roadmaps change weekly and architecture should not.

---

## 11. When to Build Abstractions

The standing engineering rules. They exist because each was learned expensively.

1. **Design the seam now; extract on the second real case.** An abstraction built against one
   consumer is shaped by imagination. *(ADR 0001)*
2. **No business logic in React components.** It cannot be tested, reused or reasoned about there.
3. **Every database write is guarded.** PostgREST failures resolve rather than throw; an unguarded
   write is a silent data-loss bug. *(Cost: three months of lost loyalty ledger rows.)*
4. **No fabricated figures, ever.** A metric that cannot be computed from real data is withheld,
   never estimated.
5. **The Universal Core imports no Industry Module.** *(Ch 32, Law 1.)*
6. **One implementation per behaviour.** Points arithmetic lives in the loyalty service; model calls
   in the AI layer; scheduling in the Automation Engine.
7. **Prefer compile-time failure.** Generated database types, typed registries, validated manifests —
   catch it where it is cheapest.
8. **Verify against reality before calling it done.** Every defect that reached production passed
   its typecheck first.

---

## 12. Business Milestones

| Milestone | Exit criteria |
|---|---|
| **Customer 0** | Golden Demo Venue exists; screenshots and a demo video produced; assets labelled as demonstrations, never as case studies |
| **Customer 1** | One restaurant using the product on real guests; the retention loop closes once end to end |
| **Customer 10** | Paying; Meta live; WhatsApp primary; onboarding runs without founder intervention |
| **Customer 100** | Framework extracted; Demo Factory built; aggregation layer in place; second industry viable |

---

## 13. Future Modules

```
Restaurant  →  Hotel  →  Retail  →  Healthcare  →  Marketplace  →  HGOS Cloud
```

Direction, not commitment. Each step is gated on the previous one proving itself, and every one of
them is governed by the same law: *own the operational layer only where the incumbent is weak or
absent; integrate where it is entrenched.*

Healthcare carries obligations the others do not — special-category data, and an assistant that must
never cross into clinical advice. It is last for regulatory reasons, not technical ones.

---

## 14. Decision Log

Recording *what* was decided and *why*, so good decisions are not quietly reversed in three weeks.

| Date | Decision | Reasoning |
|---|---|---|
| 2026-07-30 | Sell Product A, defer Product B | Product A is ~85% and is the differentiator. Product B is months of work competing with entrenched POS vendors |
| 2026-07-30 | Positioning is *AI Growth Platform*, not *Restaurant OS* | Easier sale, stronger moat, and consistent with Ch 32's own law |
| 2026-07-30 | Email is a fallback channel, not a repositioning | WhatsApp remains the long-term primary; email unblocks pilots while Meta is pending |
| 2026-07-30 | No unofficial WhatsApp tooling | Grey-market tools risk banning **customers'** numbers. Fatal for a platform whose product is trusted guest messaging |
| 2026-07-30 | Business registration is the top priority | It alone blocks Meta, Stripe live, contracts and invoicing |
| 2026-07-30 | Golden Demo Venue, not Demo Factory | A convincing demo is 1–2 days; a simulation platform is weeks. Build the engine when reuse justifies it |
| 2026-07-30 | Architecture frozen at Chapters 30–33 | The remaining risk is market validation. No engineering problem left is worth solving before a customer conversation |
| 2026-07-30 | Free pilot before paid | Charging requires an entity; learning does not |
