import { useEffect, useState } from 'react'
import { supabase } from './supabase-client'

type CurrencyCode = 'AED' | 'OMR' | 'SAR' | 'KWD' | 'BHD' | 'QAR' | 'PKR' | 'BDT'
type FxRate = { code: CurrencyCode; aed_per_unit: number }

const SUPPORTED: CurrencyCode[] = ['OMR', 'AED', 'SAR', 'KWD', 'BHD', 'QAR', 'PKR', 'BDT']

// Fallback reference rates: AED value of one unit of the selected currency.
// Admin-published Supabase rates take priority when available.
const FALLBACK_AED_PER_UNIT: Record<CurrencyCode, number> = {
  AED: 1,
  OMR: 9.55,
  SAR: 0.979,
  KWD: 11.97,
  BHD: 9.74,
  QAR: 1.007,
  PKR: 0.0131,
  BDT: 0.0305,
}

function readCurrency(): CurrencyCode {
  try {
    const saved = window.localStorage.getItem('msheireb-currency')
    return SUPPORTED.includes(saved as CurrencyCode) ? (saved as CurrencyCode) : 'OMR'
  } catch {
    return 'OMR'
  }
}

function parseAedLabel(label: string): { prefix: string; amount: number; suffix: string } | null {
  const match = label.match(/^(.*?)(?:AED)\\s*([\\d,.]+)\\s*(M|K)?(.*)$/i)
  if (!match) return null
  const base = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(base)) return null
  const multiplier = match[3]?.toUpperCase() === 'M' ? 1_000_000 : match[3]?.toUpperCase() === 'K' ? 1_000 : 1
  return { prefix: match[1], amount: base * multiplier, suffix: match[4] }
}

function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'PKR' || currency === 'BDT' ? 0 : 2,
  }).format(amount)
}

/** Converts AED property labels to the selected display currency. Wallet ledger values are not converted. */
export function useFxPriceLabel() {
  const [currency, setCurrency] = useState<CurrencyCode>('OMR')
  const [rates, setRates] = useState<Partial<Record<CurrencyCode, number>>>({})

  useEffect(() => {
    setCurrency(readCurrency())
    const onCurrencyChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (SUPPORTED.includes(detail as CurrencyCode)) setCurrency(detail as CurrencyCode)
    }
    const onStorage = (event: StorageEvent) => {
      if (event.key === 'msheireb-currency') setCurrency(readCurrency())
    }
    window.addEventListener('msheireb-currency-change', onCurrencyChange)
    window.addEventListener('storage', onStorage)
    return () => {
      window.removeEventListener('msheireb-currency-change', onCurrencyChange)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  useEffect(() => {
    let active = true
    if (!supabase) return
    supabase.from('fx_rates').select('code,aed_per_unit').in('code', SUPPORTED)
      .then(({ data, error }) => {
        if (!active || error || !data) return
        const next: Partial<Record<CurrencyCode, number>> = {}
        for (const row of data as FxRate[]) {
          const rate = Number(row.aed_per_unit)
          if (SUPPORTED.includes(row.code) && Number.isFinite(rate) && rate > 0) next[row.code] = rate
        }
        setRates(next)
      })
    return () => { active = false }
  }, [])

  return (label: string): string => {
    if (currency === 'AED') return label
    const parsed = parseAedLabel(label)
    if (!parsed) return label
    const aedPerUnit = rates[currency] ?? FALLBACK_AED_PER_UNIT[currency]
    return `${parsed.prefix}${formatMoney(parsed.amount / aedPerUnit, currency)}${parsed.suffix}`
  }
}
