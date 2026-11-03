import { useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

/**
 * Returns a lookup that prefers the price published by administration and falls
 * back to the price shipped with the site data.
 */
export function useResidencePrice() {
  const rows = useQuery(api.properties.prices)

  return (slug: string, fallback: string) => {
    const match = rows?.find((row) => row.slug === slug)
    return match?.priceLabel ?? fallback
  }
}
