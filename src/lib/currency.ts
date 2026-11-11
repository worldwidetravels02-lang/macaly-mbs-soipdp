/** Supported display currencies. Rates are AED value per one unit of currency. */
export const CURRENCIES = [
  { code: 'OMR', label: 'OMR · Omani rial', aedPerUnit: 9.55 },
  { code: 'AED', label: 'AED · UAE dirham', aedPerUnit: 1 },
  { code: 'SAR', label: 'SAR · Saudi riyal', aedPerUnit: 0.979 },
  { code: 'KWD', label: 'KWD · Kuwaiti dinar', aedPerUnit: 11.97 },
  { code: 'BHD', label: 'BHD · Bahraini dinar', aedPerUnit: 9.74 },
  { code: 'QAR', label: 'QAR · Qatari riyal', aedPerUnit: 1.007 },
  { code: 'PKR', label: 'PKR · Pakistani rupee', aedPerUnit: 0.0131 },
  { code: 'BDT', label: 'BDT · Bangladeshi taka', aedPerUnit: 0.0305 },
] as const

export type CurrencyCode = (typeof CURRENCIES)[number]['code']

/** Legacy fixed reservation deposit quoted in AED. */
export const RESERVATION_DEPOSIT_AED = 200

export function rateFor(code: string, rates?: { code: string; aedPerUnit: number }[]) {
  const live = rates?.find((rate) => rate.code === code)
  if (live && Number.isFinite(live.aedPerUnit) && live.aedPerUnit > 0) return live.aedPerUnit
  return CURRENCIES.find((rate) => rate.code === code)?.aedPerUnit ?? 1
}

export function convertFromAed(amountAed: number, aedPerUnit: number) {
  if (!Number.isFinite(amountAed) || !Number.isFinite(aedPerUnit) || aedPerUnit <= 0) return 0
  return Math.round((amountAed / aedPerUnit) * 100) / 100
}

export function formatMoney(amount: number, code: string) {
  const decimals = code === 'PKR' || code === 'BDT' ? 0 : 2
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number.isFinite(amount) ? amount : 0)
}
