import type { AuthError, Session, User } from '@supabase/supabase-js'
import { requireSupabase } from './supabase-client'

export type SupabaseAuthResult = {
  user: User | null
  session: Session | null
}

function throwIfError(error: AuthError | null) {
  if (error) throw error
}

/** Sign in with the customer's email and password. */
export async function signInWithEmail(email: string, password: string): Promise<SupabaseAuthResult> {
  const { data, error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  })
  throwIfError(error)
  return { user: data.user, session: data.session }
}

/** Create a customer account. Email confirmation may be required by Supabase settings. */
export async function signUpWithEmail(
  email: string,
  password: string,
  profile: { full_name?: string; mobile?: string } = {},
): Promise<SupabaseAuthResult> {
  const client = requireSupabase()
  const normalizedEmail = email.trim().toLowerCase()
  const { data, error } = await client.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        full_name: profile.full_name?.trim() || '',
        mobile: profile.mobile?.trim() || '',
      },
    },
  })
  throwIfError(error)

  if (data.user && data.session) {
    const { error: profileError } = await client.from('profiles').upsert({
      id: data.user.id,
      full_name: profile.full_name?.trim() || null,
      mobile: profile.mobile?.trim() || null,
    }, { onConflict: 'id' })
    throwIfError(profileError)
  }

  return { user: data.user, session: data.session }
}

/** Sign out the current user on this device. */
export async function signOut(): Promise<void> {
  const { error } = await requireSupabase().auth.signOut()
  throwIfError(error)
}

/** Read the current Supabase session. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data, error } = await requireSupabase().auth.getSession()
  throwIfError(error)
  return data.session
}

/** Check admin membership using the authenticated user's RLS-protected row. */
export async function isCurrentUserAdmin(): Promise<boolean> {
  const client = requireSupabase()
  const { data: { user }, error: userError } = await client.auth.getUser()
  throwIfError(userError)
  if (!user) return false

  const { data, error } = await client
    .from('admin_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  throwIfError(error)
  return Boolean(data)
}
