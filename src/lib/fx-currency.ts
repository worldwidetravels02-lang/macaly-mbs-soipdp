import { useEffect, useState } from 'react'
import { supabase } from './supabase-client'

type CurrencyCode = 'AED' | 'OMR' | 'SAR' | 'KWD' | 'BHD' | 'QAR'
type FxRate = { code: CurrencyCode; aed_per_unit: number }

const SUPPORTED: CurrencyCode[] = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR']

function readCurrency(): CurrencyCode {
  try {
    const saved = window.localStorage.getItem('msheireb-currency')
    return SUPPORTED.includes(saved as CurrencyCode) ? (saved as CurrencyCode) : 'AED'
  } catch {
    return 'AED'
  }
}

function parseAedLabel(label: string): { prefix: string; amount: number } | null {
  const match = label.match(/^(.*?)(?:AED)\\s*([\\d,.]+)\\s*(M|K)?(.*)$/i)
  if (!match) return null
  const base = Number(match[2].replace(/,/g, ''))
  if (!Number.isFinite(base)) return null
  const multiplier = match[3]?.toUpperCase() === 'M' ? 1_000_000 : match[3]?.toUpperCase() === 'K' ? 1_000 : 1
  return { prefix: match[1], amount: base * multiplier }
}

function formatMoney(amount: number, currency: CurrencyCode): string {
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Converts AED listing labels only when a current admin-published FX rate exists. */
export function useFxPriceLabel() {
  const [currency, setCurrency] = useState<CurrencyCode>('AED')
  const [rates, setRates] = useState<Partial<Record<CurrencyCode, number>>>({})

  useEffect(() => {
    setCurrency(readCurrency())
    const onCurrencyChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (SUPPORTED.includes(detail as CurrencyCode)) setCurrency(detail as CurrencyCode)
    }
    window.addEventListener('msheireb-currency-change', onCurrencyChange)
    return () => window.removeEventListener('msheireb-currency-change', onCurrencyChange)
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
    const aedPerUnit = rates[currency]
    if (!parsed || !aedPerUnit) return label
    return `${parsed.prefix}${formatMoney(parsed.amount / aedPerUnit, currency)}`
  }
}
