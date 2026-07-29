# ADR 0001 — Capability Registry

**Status:** Accepted, deliberately unimplemented
**Date:** 2026-07-29
**Applies to:** Automation Engine, and every future Industry Module

---

## Context

The Automation Engine (Phase 1) is the platform's workflow foundation. It runs
one pipeline — event → trigger → workflow → conditions → actions → execution —
and today the Restaurant Module is its only source of events.

Future modules are planned: Hotel, Resort, Café, Fast Food, Retail, Beauty &
Spa, Healthcare. Each will need the engine to react to things that happen
inside it. Without a defined extension point, the obvious path is for the
engine to grow knowledge of each industry, and that path ends with a workflow
engine that cannot be reasoned about without knowing what a resort is.

## Decision

Define a **Capability Registry** as the extension point through which Industry
Modules contribute behaviour to the engine. Define it as types and interfaces
now; implement it when a second Industry Module exists.

The types live in `src/lib/automation/capabilities.ts`. There is no registry
instance, no resolution logic, and no call site.

---

## Why the registry exists

The engine must be able to act on things it has never heard of.

Without a registry, `Automation Engine` eventually imports `Restaurant Module`
to learn what a reservation is, then `Hotel Module` to learn what a stay is.
Each import is individually reasonable and collectively fatal: the engine
becomes the union of every industry it serves, and adding an industry means
editing the engine.

With a registry, an industry module *declares* what it provides and the engine
consults the declaration. The dependency points one way — modules depend on the
engine, never the reverse — and that direction is the property being protected.

## Why capabilities are behaviours, not schemas

A capability is `booking`: the behaviour of something being reserved for
someone at a time. It is not a table, an entity or a component.

This matters because schemas do not survive translation across industries and
behaviours do. A restaurant reservation has a party size and a slot. A hotel
stay has check-in, check-out and a room type. A spa appointment has a therapist
and a duration. There is no useful shared schema — attempting one produces a
lowest common denominator that describes none of them correctly.

The lifecycle *does* translate. "A booking was cancelled" is meaningful in all
three, and a workflow reacting to it is meaningful in all three. So the engine
shares a vocabulary of lifecycle phases and nothing else:

```
booking:  created · confirmed · rescheduled · cancelled · completed · no_show
orders:   placed · accepted · preparing · ready · fulfilled · cancelled
payments: authorised · captured · refunded · failed
```

Everything that does not translate — party size, room type, treatment length —
stays in the provider's payload, opaque to the engine. The rule that follows:
**the engine may rely on the phase; it may never rely on the payload.** The
moment it reads `payload.partySize`, it has become a restaurant engine.

## Why the registry is typed rather than string-keyed

`registry.get('booking')` is a runtime discovery mechanism. A misspelling
compiles, deploys, and returns nothing — and the workflow that depended on it
silently never fires.

This codebase has already paid for that class of defect more than once. The
`conversation_channel` enum accepted an invented value and failed at runtime
with a `22P02`; the fix was to generate enum unions from the live schema so an
invalid value became a compile error. A loyalty ledger write failed silently for
three months because a failed insert resolves rather than throws. The consistent
lesson is that discovery should happen at build time.

So `CapabilityName` is a closed union, phases are typed against their own
capability, and `register<C>` is generic. All three of the following fail to
compile:

| Mistake | Compiler response |
|---|---|
| A `booking` provider declaring `'captured'` | `'captured'` is not assignable to the booking phases |
| A provider for `'teleportation'` | does not satisfy the constraint `CapabilityName` |
| `capability: 'orders'` on a `CapabilityProvider<'booking'>` | `'orders'` is not assignable to `'booking'` |

Verified by compiling all three deliberately, confirming three errors, and
deleting the probe.

## Why multiple providers per capability

A resort is a hotel, a restaurant and a spa in one venue. All three provide
`booking`. This is not an edge case to accommodate later — it is on the
roadmap, and a registry that returns a single provider cannot be widened
afterwards without changing every caller.

So `providersOf()` returns an array from the outset, and lookup is scoped by
venue: a resort has three booking providers, a café has none.

**The engine already supports this.** A workflow's `trigger_config` filter
compares keys against the event payload, so a workflow narrows to one provider
with `{ provider: 'hotel.stay' }` — using a mechanism built in Phase 1 for an
unrelated reason. Multi-provider dispatch needs no engine change; it needs a
naming convention, which this ADR supplies.

## Why implementation is deferred

An extension framework built against a single consumer is shaped by
imagination rather than requirements. With only the Restaurant Module, there is
nothing to dispatch between: `providersOf('booking')` would return one element,
forever, and every design question the registry exists to answer would be
settled by guessing.

The cost of deferring is a file of unused types. The cost of building now is an
abstraction fitted to a hypothetical second industry, discovered to be wrong
when the real one arrives, and expensive to change because by then the engine
routes through it.

This follows the standing rule for this platform: **design the seam now,
extract the implementation when the second case appears.** The same rule
governs the loyalty earning strategy — `awardPoints` keeps its spend-based
calculation until a Hotel Module needs stay-based earning, at which point the
two real cases define the interface between them.

The trigger for implementation is specific: **the second Industry Module.** Not
a date, not a milestone — the arrival of a second provider for any capability.

## Consequences

**Now**

- One new file of types. No runtime behaviour, no API surface, no schema,
  no migration, no workflow change.
- The engine continues matching plain event names, which works.
- Removing the file would change nothing — the property a deferred abstraction
  should have.

**When the second module arrives**

- Implement `CapabilityRegistry` against two real providers.
- Industry modules register providers at startup and emit
  `<capability>.<phase>` events carrying `provider` and `module`.
- The workflow builder gains capability-aware trigger discovery scoped to the
  venue's installed modules.
- Existing workflows continue to run: their event names are unchanged and the
  engine still matches strings.

**Risks accepted**

- The lifecycle vocabulary is a guess until a second industry tests it. Phases
  will likely be added. Adding a phase is backward-compatible; renaming one is
  not, so names should be conservative.
- `providerId` appears in workflow trigger filters, making it a public
  contract. Renaming a provider breaks existing workflows and needs a
  migration path.

## Alternatives considered

**Engine imports industry modules directly.** Simplest today. Rejected: it
inverts the dependency the engine exists to protect, and every new industry
edits the engine.

**One generic `entity.changed` event with a type discriminator.** Rejected: it
pushes all meaning into the payload, so every workflow condition becomes a
string comparison against untyped data and the builder can offer no useful
choices.

**Fully implement the registry now.** Rejected for the reasons in *Why
implementation is deferred*.

**Do nothing until the second module.** Tempting, and nearly right. Rejected
because the naming convention and the multi-provider decision affect how
Phase 1 events are named *today* — deciding them now costs a file, and
deciding them later costs a rename of live events.
