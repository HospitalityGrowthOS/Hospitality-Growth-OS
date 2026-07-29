/**
 * Catches mistyped email domains before a message is sent into the void.
 *
 * `type="email"` only checks shape, so `kebaieraziz@fmail.com` sails through:
 * it is a perfectly well-formed address at a domain the user never meant. The
 * magic link then goes nowhere and the screen still says "check your email".
 *
 * This compares the typed domain against domains people actually use and
 * suggests the closest one. It is a hint, never a block — someone on a genuine
 * unusual domain must always be able to proceed.
 */

/** Domains common among this product's users: German market plus the majors. */
const KNOWN_DOMAINS = [
  // Majors
  'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.de', 'hotmail.com',
  'hotmail.de', 'live.com', 'live.de', 'yahoo.com', 'yahoo.de', 'icloud.com',
  'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com', 'mail.com',
  // German providers
  'gmx.de', 'gmx.net', 'gmx.at', 'gmx.ch', 'web.de', 't-online.de',
  'freenet.de', 'posteo.de', 'mailbox.org', 'arcor.de', 'online.de',
]

/**
 * Damerau-Levenshtein distance, capped early — we only care about small values.
 *
 * Counts a transposition as one edit rather than two, which matters because
 * swapped adjacent letters (`gmx.ed` for `gmx.de`) are the single most common
 * typing error; plain Levenshtein scores those 2 and would miss them.
 */
function distance(a: string, b: string): number {
  if (a === b) return 0
  if (Math.abs(a.length - b.length) > 2) return 99

  // Three rows: two back is what makes transposition detection possible.
  let twoBack: number[] = []
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let value = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, twoBack[j - 2] + 1)
      }
      curr[j] = value
    }
    twoBack = prev
    prev = curr
  }
  return prev[b.length]
}

/**
 * Returns a corrected address when the domain looks like a near-miss of a
 * common one, or null when it looks fine or is too far from anything to guess.
 */
export function suggestEmailCorrection(input: string): string | null {
  const email = input.trim().toLowerCase()
  const at = email.lastIndexOf('@')
  if (at < 1 || at === email.length - 1) return null

  const local = email.slice(0, at)
  const domain = email.slice(at + 1)

  // A domain we recognise is correct by definition.
  if (KNOWN_DOMAINS.includes(domain)) return null

  let best: string | null = null
  let bestDistance = Infinity

  for (const candidate of KNOWN_DOMAINS) {
    const d = distance(domain, candidate)
    // Short domains get a tighter budget: at one edit, `web.de` and `web.com`
    // are neighbours, and guessing between real domains is worse than silence.
    const budget = candidate.length <= 8 ? 1 : 2
    if (d <= budget && d < bestDistance) {
      best = candidate
      bestDistance = d
    }
  }

  return best ? `${local}@${best}` : null
}

/** Normalises what the user typed — trailing spaces and capitals break sign-in. */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase()
}
