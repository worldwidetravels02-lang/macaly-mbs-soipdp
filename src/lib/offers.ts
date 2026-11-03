import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

/** Returns the live offer title for a listing slug, if administration published one. */
export function useActiveOffers() {
  const rows = useQuery(api.promotions.activePromotions)

  return (slug: string) => rows?.find((row) => row.slug === slug)?.title ?? null
}

/** Returns the full live offer for a listing slug. */
export function useOffer(slug: string) {
  const rows = useQuery(api.promotions.activePromotions)
  return rows?.find((row) => row.slug === slug) ?? null
}
