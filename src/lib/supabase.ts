import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

/**
 * Browser-safe Supabase client. Only the public publishable/anon key belongs
 * in VITE_ variables. Never place a service-role or secret key in frontend code.
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null

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
 * Make a public-key authenticated request to a Supabase REST endpoint.
 * Prefer the Supabase client for auth-aware requests so the user's access
 * token is used. Never use service_role in browser code.
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
