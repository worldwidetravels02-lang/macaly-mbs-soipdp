import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type PropertyPrice = { slug: string; price_label: string }

/** Reads published price overrides from the Supabase properties table. */
export function useResidencePrice() {
  const [rows, setRows] = useState<PropertyPrice[]>([])

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase
      .from('properties')
      .select('slug, price_label')
      .eq('status', 'published')
      .then(({ data, error }) => {
        if (!active) return
        if (error) {
          console.error('Could not load property prices:', error.message)
          return
        }
        setRows(data ?? [])
      })
    return () => { active = false }
  }, [])

  return (slug: string, fallback: string) =>
    rows.find((row) => row.slug === slug)?.price_label ?? fallback
}
