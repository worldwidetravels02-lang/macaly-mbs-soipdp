import { useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase-client'

type Promotion = {
  id: string
  title: string
  description: string | null
  image_url: string | null
  property_slug: string | null
  active: boolean
  starts_at: string | null
  ends_at: string | null
}

function useActivePromotions() {
  const [rows, setRows] = useState<Promotion[]>([])

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        const { data, error } = await requireSupabase()
          .from('promotions')
          .select('id,title,description,image_url,property_slug,active,starts_at,ends_at')
          .eq('active', true)
          .order('created_at', { ascending: false })
        if (!mounted) return
        if (error) {
          console.error('Could not load active promotions:', error.message)
          return
        }
        const now = Date.now()
        setRows(((data ?? []) as Promotion[]).filter((item) =>
          (!item.starts_at || new Date(item.starts_at).getTime() <= now) &&
          (!item.ends_at || new Date(item.ends_at).getTime() >= now),
        ))
      } catch (error) {
        console.error('Could not load promotions from Supabase:', error)
      }
    }
    void load()
    return () => { mounted = false }
  }, [])

  return rows
}

/** Returns the active offer title for a property slug. */
export function useActiveOffers() {
  const rows = useActivePromotions()
  return (slug: string) => rows.find((row) => !row.property_slug || row.property_slug === slug)?.title ?? null
}

/** Returns the active offer for a property slug. */
export function useOffer(slug: string) {
  const rows = useActivePromotions()
  const item = rows.find((row) => !row.property_slug || row.property_slug === slug)
  return item ? { ...item, detail: item.description ?? '' } : null
}
