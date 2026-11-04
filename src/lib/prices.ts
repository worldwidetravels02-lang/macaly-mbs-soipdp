import { useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase-client'

type PropertyPrice = { slug: string; price_label: string }

/**
 * Returns a lookup that prefers the price label published by administration
 * and falls back to the price shipped with the site data.
 */
export function useResidencePrice() {
  const [rows, setRows] = useState<PropertyPrice[]>([])

  useEffect(() => {
    let active = true
    requireSupabase()
      .from('property_prices')
      .select('slug,price_label')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Could not load published property prices:', error.message)
          return
        }
        setRows((data ?? []) as PropertyPrice[])
      })
    return () => { active = false }
  }, [])

  return (slug: string, fallback: string) => {
    const match = rows.find((row) => row.slug === slug)
    return match?.price_label ?? fallback
  }
}
