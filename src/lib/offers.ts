/** Promotions are managed in Supabase. The current promotions schema has no
 * residence slug, so it is safer not to attach a promotion to the wrong home.
 * This returns no per-residence offer until a property_id/slug relationship is
 * added to the database schema.
 */
export function useActiveOffers() {
  return (_slug: string) => null
}

export function useOffer(_slug: string) {
  return null
}
