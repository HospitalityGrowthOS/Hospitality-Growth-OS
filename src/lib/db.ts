/**
 * Write-result guards for PostgREST.
 *
 * A failed Supabase write does not throw — it resolves with `{ error }`.
 * Any `await client.from(...).insert(...)` that discards its result therefore
 * swallows constraint violations, missing columns and schema drift without a
 * trace. That is how nine welcome-bonus ledger rows were lost over three
 * months: the insert failed on a NOT NULL constraint every time, and the
 * endpoint reported success every time. A try/catch around the await catches
 * nothing, because nothing is thrown.
 *
 * Route every fire-and-forget write through one of these instead:
 *
 *  - `mustWrite` — the flow depends on the row. Throws so the caller's error
 *    handling fires and the client sees a real failure (and webhook callers
 *    like Stripe retry).
 *  - `tryWrite`  — best-effort bookkeeping (analytics, message logs, audit
 *    trails). Logs the failure and reports it to the caller, never throws.
 */

interface WriteResult {
  error: { message: string; code?: string } | null
}

/** Awaits a write the flow depends on; throws with context if it failed. */
export async function mustWrite(context: string, query: PromiseLike<WriteResult>): Promise<void> {
  const { error } = await query
  if (error) {
    throw new Error(`[db] ${context}: ${error.message}`)
  }
}

/**
 * Awaits a best-effort write; logs a failure and returns false instead of
 * throwing. Use only where the surrounding flow genuinely should continue.
 */
export async function tryWrite(context: string, query: PromiseLike<WriteResult>): Promise<boolean> {
  const { error } = await query
  if (error) {
    console.error(`[db] ${context}: ${error.message}`)
    return false
  }
  return true
}
