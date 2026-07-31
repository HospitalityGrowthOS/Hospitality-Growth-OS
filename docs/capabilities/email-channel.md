# Capability — Email as a working guest channel

**Status:** defined, not started · **Priority:** P0 (blocks customer #1) · **Defined:** 31 July 2026

---

## What this is for

A guest the venue cannot reach is a guest the platform cannot serve. Today HGOS can reach a guest
only over WhatsApp, and WhatsApp is unavailable until Meta verification completes — which is blocked
on business registration, which has no date.

Email removes that dependency for pilots. It is the difference between "the product works once
paperwork clears" and "the product works now, and gets better when paperwork clears."

## Why it is the next thing

Measured against the current codebase, not estimated:

- `src/lib/email.ts` exports **one** function — the loyalty welcome — called from **one** place, the
  QR signup route. Nothing else in the product can send an email.
- `review_requests.channel` already stores `whatsapp | email`, and the dispatcher
  (`api/reviews/send-request`) contains **zero** references to it. Every request is sent as a
  WhatsApp template regardless of what the column says.
- In the Golden Demo Venue that leaves **42 review requests marked `email` that could never be
  delivered**, and **16 of 164 guests reachable by no channel the product can actually use.**

The data model already expresses the intent. The send path ignores it.

## What done looks like

Each of these is observable, not a feeling:

1. A guest with an email address and no WhatsApp opt-in receives a review request, and answering it
   moves the same `review_requests` row through the same lifecycle a WhatsApp guest would.
2. The dispatcher honours `channel` instead of ignoring it, and picks a channel when one is not
   already set — WhatsApp where the guest opted in, email otherwise, nothing where neither exists.
3. A send that cannot happen is recorded as not having happened. No status says `sent` unless
   something was sent. (See the stub-logging bug of 30 July: the message log was recording
   suppressed sends as delivered.)
4. Every existing guard still holds: demo venues send nothing, writes go through `mustWrite` /
   `tryWrite`, and no code path assumes WhatsApp.
5. Resend's domain is verified so mail lands rather than bouncing. **Founder action, ~30 minutes** —
   this capability cannot be finished without it.

## What this explicitly does **not** include

Written down because every one of these is a plausible next step, and none of them is this one.

- **No repositioning.** WhatsApp stays the long-term primary channel. Email is a fallback that keeps
  pilots moving. (Decision log, 30 July.)
- **No email marketing platform.** No drag-and-drop builder, no template gallery, no A/B testing, no
  send-time optimisation, no unsubscribe-preference centre beyond the legal minimum.
- **No new campaign surface.** Campaigns already exist. This capability makes an existing message
  reach a guest by a second route; it does not add a place to compose messages.
- **No deliverability engineering.** Resend handles sending. No warm-up pools, no dedicated IPs, no
  bounce-reputation dashboards, no seed-list monitoring.
- **No SMS.** A third channel multiplies the routing problem before the second one is proven.
- **No inbound email.** Guests replying by email is a conversation surface, not a delivery channel,
  and belongs with the assistant if it is ever wanted.
- **No per-guest channel preference UI.** Opt-in state already implies the routing. A preference
  screen is a customer request, not a prerequisite.

If a real venue asks for one of these, it stops being out of scope and becomes a roadmap item with
their name attached — per §7 of the roadmap.

## How it extends the audit

Per the standing obligation in §10, this ships with its checks:

- No `review_requests` row is marked `email` for a guest with no email address, and none is marked
  `whatsapp` for a guest who never opted in — the channel recorded must be one that could work.
- Every guest reachable by some channel has been reached by it, or has a recorded reason why not.
- The stub rule holds across both channels: nothing is logged as sent that was not sent.

And the meta-rule: each new check is demonstrated to fail before it is trusted.

## Known risks

- **Deliverability is not correctness.** The audit can prove a message was accepted by Resend. It
  cannot prove it reached an inbox. Do not let a green audit imply guests are being reached — the
  only real signal is response rate, which the completion-rate fix now measures honestly.
- **The demo's email addresses look real.** They are `firstname.lastname@gmail.com`-shaped and may
  belong to actual people. The demo guard in `src/lib/demo.ts` is the only thing standing between a
  test run and mailing strangers. Do not weaken it to test this capability; test with a venue that
  is not flagged `is_demo`.

## Estimate

~1.5 days of engineering, plus the founder's 30 minutes of DNS. The estimate is small because the
templates, the lifecycle, the guards and the audit already exist. The work is routing, not building.
