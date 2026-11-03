/** Currencies members can pay in. AED is the base currency. */
export const CURRENCIES = [
  { code: 'AED', label: 'AED · UAE dirham', aedPerUnit: 1 },
  { code: 'USD', label: 'USD · US dollar', aedPerUnit: 3.6725 },
  { code: 'INR', label: 'INR · Indian rupee', aedPerUnit: 0.0441 },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

/** Fixed reservation deposit quoted in AED, converted for card payment. */
export const RESERVATION_DEPOSIT_AED = 200

export function rateFor(code: string, rates?: { code: string; aedPerUnit: number }[]) {
  const live = rates?.find((rate) => rate.code === code)
  if (live) return live.aedPerUnit
  return CURRENCIES.find((rate) => rate.code === code)?.aedPerUnit ?? 1
}

export function convertFromAed(amountAed: number, aedPerUnit: number) {
  return Math.round((amountAed / aedPerUnit) * 100) / 100
}

export function formatMoney(amount: number, code: string) {
  const decimals = code === 'INR' ? 0 : 2
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount)
}
