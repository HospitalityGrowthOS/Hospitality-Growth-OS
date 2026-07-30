/**
 * Money formatting.
 *
 * The platform hardcoded `€` in 26 places across 15 files while a correct,
 * locale-aware `formatCurrency` sat unused in utils.ts. That was invisible
 * while every venue was in Germany and immediately wrong the moment one was
 * not — a Quebec restaurateur seeing €47.50 knows within a second that this
 * was not built for them.
 *
 * Currency is a property of the venue, resolved from its settings, so a single
 * platform can serve Berlin and Québec at once.
 */

export interface MoneyFormat {
  currency: string
  locale: string
  /** The bare symbol, for compact labels like "10 pts per $1". */
  symbol: string
}

/** Currencies the platform formats today. Extend as markets are added. */
const FORMATS: Record<string, MoneyFormat> = {
  EUR: { currency: 'EUR', locale: 'de-DE', symbol: '€' },
  CAD: { currency: 'CAD', locale: 'fr-CA', symbol: '$' },
  USD: { currency: 'USD', locale: 'en-US', symbol: '$' },
  GBP: { currency: 'GBP', locale: 'en-GB', symbol: '£' },
  CHF: { currency: 'CHF', locale: 'de-CH', symbol: 'CHF' },
}

export const DEFAULT_CURRENCY = 'EUR'

/**
 * Resolves a venue's money format from its settings.
 *
 * Accepts the settings object directly rather than a venue, so server
 * components, service code and the AI layer can all use it without agreeing on
 * a venue shape.
 */
export function moneyFormat(settings: unknown): MoneyFormat {
  const code = (settings as { currency?: unknown } | null)?.currency
  if (typeof code === 'string' && FORMATS[code.toUpperCase()]) {
    return FORMATS[code.toUpperCase()]
  }
  return FORMATS[DEFAULT_CURRENCY]
}

/** Full formatted amount — "47,50 $" in Québec, "47,50 €" in Germany. */
export function formatMoney(amount: number, settings: unknown, opts?: { decimals?: number }): string {
  const f = moneyFormat(settings)
  const decimals = opts?.decimals ?? 2
  return new Intl.NumberFormat(f.locale, {
    style: 'currency',
    currency: f.currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}

/** Whole-unit amount, for dashboard tiles where cents are noise. */
export function formatMoneyShort(amount: number, settings: unknown): string {
  return formatMoney(amount, settings, { decimals: 0 })
}

/** Just the symbol, for labels such as "Points per $1 spent". */
export function currencySymbol(settings: unknown): string {
  return moneyFormat(settings).symbol
}
