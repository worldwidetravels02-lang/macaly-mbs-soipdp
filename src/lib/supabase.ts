/**
 * Supabase REST connection for the Vite/TanStack application.
 *
 * Configure these as build-time variables in Cloudflare:
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * This lightweight helper intentionally does not replace the existing
 * Convex authentication/provider yet. Authentication migration is a
 * separate step and must be tested before Convex is removed.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export function getSupabaseConfig() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in the deployment build environment.',
    )
  }

  return {
    url: supabaseUrl.replace(/\/$/, ''),
    anonKey: supabaseAnonKey,
  }
}

/**
 * Make an authenticated request to a Supabase REST endpoint.
 * Use only the publishable/anon key in browser code. Never use service_role here.
 */
export async function supabaseRest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const config = getSupabaseConfig()
  const response = await fetch(`${config.url}/rest/v1/${path.replace(/^\//, '')}`, {
    ...options,
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase request failed (${response.status}): ${detail}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
