export const CURRENCIES = ['OMR', 'AED', 'SAR', 'KWD', 'BHD', 'QAR'] as const
export type DisplayCurrency = (typeof CURRENCIES)[number]
export type DisplayRates = Record<DisplayCurrency, number>

// Admin stores each currency's value in AED. Convert those manually-entered
// values into units per OMR so customer balances remain stored in OMR.
export async function loadAdminDisplayRates(client: any): Promise<DisplayRates> {
  const { data, error } = await client.from('fx_rates').select('code,aed_per_unit')
  if (error) throw error
  const aedValues: Partial<Record<DisplayCurrency, number>> = {}
  for (const row of data ?? []) {
    if (CURRENCIES.includes(row.code) && Number(row.aed_per_unit) > 0) {
      aedValues[row.code as DisplayCurrency] = Number(row.aed_per_unit)
    }
  }
  const omrAedValue = aedValues.OMR
  if (!omrAedValue) throw new Error('The administrator has not configured the OMR exchange rate yet.')
  const rates = {} as DisplayRates
  for (const code of CURRENCIES) {
    const value = aedValues[code]
    if (!value) throw new Error('The administrator has not configured the ' + code + ' exchange rate yet.')
    rates[code] = omrAedValue / value
  }
  rates.OMR = 1
  return rates
}

export function convertDisplayAmount(value: number | string, from: DisplayCurrency, to: DisplayCurrency, rates: DisplayRates) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  if (from === to) return amount
  const fromRate = rates[from], toRate = rates[to]
  return fromRate > 0 && toRate > 0 ? amount / fromRate * toRate : amount
}

export function readDisplayCurrency(): DisplayCurrency {
  try {
    const saved = window.localStorage.getItem('msheireb-currency')
    return CURRENCIES.includes(saved as DisplayCurrency) ? saved as DisplayCurrency : 'OMR'
  } catch { return 'OMR' }
}

export function saveDisplayCurrency(value: DisplayCurrency) {
  try { window.localStorage.setItem('msheireb-currency', value) } catch { /* preference storage is optional */ }
  window.dispatchEvent(new CustomEvent('msheireb-currency-change', { detail: value }))
}
