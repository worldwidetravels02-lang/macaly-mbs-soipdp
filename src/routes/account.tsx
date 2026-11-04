import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { requireSupabase } from '@/lib/supabase-client'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/account']

type Profile = {
  full_name: string | null
  mobile: string | null
  preferred_language: string
  preferred_currency: string
}

export const Route = createFileRoute('/account')({
  head: () => {
    const canonical = canonicalUrl('/account')
    return {
      meta: [{ title: meta.title }, { name: 'description', content: meta.description }],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AccountPage,
})

function AccountPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [mobile, setMobile] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = requireSupabase()
    let active = true
    supabase.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      const currentUser = data.session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        const { data: row, error: profileError } = await supabase
          .from('profiles')
          .select('full_name,mobile,preferred_language,preferred_currency')
          .eq('id', currentUser.id)
          .maybeSingle()
        if (!active) return
        if (profileError) setError(profileError.message)
        const next = (row ?? {
          full_name: currentUser.user_metadata?.full_name ?? '',
          mobile: currentUser.user_metadata?.mobile ?? '',
          preferred_language: 'en',
          preferred_currency: 'AED',
        }) as Profile
        setProfile(next)
        setName(next.full_name ?? '')
        setMobile(next.mobile ?? '')
      }
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (!session?.user) setProfile(null)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || name.trim().length < 2 || mobile.replace(/\D/g, '').length < 7) {
      setError('Enter your full name and a valid mobile number.')
      return
    }
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const { data, error: saveError } = await requireSupabase()
        .from('profiles')
        .upsert({ id: user.id, full_name: name.trim(), mobile: mobile.trim() })
        .select('full_name,mobile,preferred_language,preferred_currency')
        .single()
      if (saveError) throw saveError
      setProfile(data as Profile)
      setNotice('Your account details have been saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your account details.')
    } finally {
      setSaving(false)
    }
  }

  const signOut = async () => {
    const { error: signOutError } = await requireSupabase().auth.signOut()
    if (signOutError) setError(signOutError.message)
    else await navigate({ to: '/' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
          {loading ? (
            <div data-testid="account-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Checking your session…</div>
          ) : !user ? (
            <div data-testid="account-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Member portal</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">You are not signed in.</h1>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-ink-soft">Sign in to manage your member details and contact our team.</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link to="/login" className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link>
                <Link to="/register" className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem]">Create an account <ArrowRight /></Link>
              </div>
            </div>
          ) : (
            <div data-testid="account-dashboard" className="grid gap-8">
              <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="eyebrow text-brass">Member portal</p>
                  <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Your account</h1>
                  <p className="mt-3 text-sm text-ink-soft">{user.email}</p>
                </div>
                <button type="button" onClick={signOut} data-testid="sign-out" className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-5 py-3 text-[0.58rem] hover:border-brass">Sign out <ArrowRight className="h-3.5 w-3.5" /></button>
              </header>
              <form onSubmit={save} data-testid="account-profile-form" className="grid max-w-2xl gap-4 border border-border bg-card p-6 sm:p-8">
                <h2 className="display text-xl">Personal details</h2>
                <label className="grid gap-2">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Full name</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required className="border border-input bg-background px-4 py-3 text-sm outline-none focus:border-brass" />
                </label>
                <label className="grid gap-2">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
                  <input value={mobile} onChange={(event) => setMobile(event.target.value)} autoComplete="tel" inputMode="tel" required className="border border-input bg-background px-4 py-3 text-sm outline-none focus:border-brass" />
                </label>
                <div className="grid gap-2 text-sm text-ink-soft">
                  <p>Email: {user.email ?? 'Not available'}</p>
                  <p>Preferred currency: {profile?.preferred_currency ?? 'AED'}</p>
                </div>
                {error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
                {notice ? <p role="status" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm">{notice}</p> : null}
                <button type="submit" disabled={saving} data-testid="account-profile-save" className="eyebrow w-fit bg-primary px-6 py-3 text-[0.58rem] text-primary-foreground disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button>
              </form>
              <div className="flex flex-wrap gap-3">
                <Link to="/dashboard" className="eyebrow inline-flex items-center gap-3 border border-border px-5 py-3 text-[0.55rem] hover:border-brass">Customer dashboard <ArrowRight className="h-3 w-3" /></Link>
                <Link to="/support" className="eyebrow inline-flex items-center gap-3 border border-border px-5 py-3 text-[0.55rem] hover:border-brass">Customer support <ArrowRight className="h-3 w-3" /></Link>
              </div>
              <p className="text-xs text-ink-soft">{SITE.name} · Your details are visible only to you and authorised administrators.</p>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
