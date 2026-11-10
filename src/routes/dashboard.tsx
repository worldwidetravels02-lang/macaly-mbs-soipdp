import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import { supabase } from '../lib/supabase'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/dashboard']

type Profile = {
  full_name: string | null
  mobile: string | null
  preferred_language: string
  preferred_currency: string
}

type Property = {
  id: string
  slug: string
  name: string
  location: string | null
  description: string | null
  price_label: string
  cover_image_url: string | null
}

type Notice = {
  id: string
  title: string
  body: string
  created_at: string
  read_at: string | null
}

export const Route = createFileRoute('/dashboard')({
  head: () => {
    const canonical = canonicalUrl('/dashboard')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'robots', content: 'noindex' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile>({
    full_name: '',
    mobile: '',
    preferred_language: 'en',
    preferred_currency: 'AED',
  })
  const [properties, setProperties] = useState<Property[]>([])
  const [notifications, setNotifications] = useState<Notice[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!supabase) {
      setError('The member portal is not configured. Please contact the website administrator.')
      setLoading(false)
      return
    }

    let active = true
    const loadMemberArea = async (id: string) => {
      setUserId(id)
      const [{ data: authData }, { data: propertyData }, { data: profileData }, { data: noticeData }] =
        await Promise.all([
          supabase.auth.getUser(),
          supabase.from('properties').select('id,slug,name,location,description,price_label,cover_image_url').eq('status', 'published').order('created_at', { ascending: false }),
          supabase.from('profiles').select('full_name,mobile,preferred_language,preferred_currency').eq('id', id).maybeSingle(),
          supabase.from('notifications').select('id,title,body,created_at,read_at').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
        ])
      if (!active) return
      setEmail(authData.user?.email ?? '')
      if (profileData) setProfile(profileData as Profile)
      setProperties((propertyData ?? []) as Property[])
      setNotifications((noticeData ?? []) as Notice[])
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      if (!data.session) {
        setLoading(false)
        void navigate({ to: '/login' })
        return
      }
      void loadMemberArea(data.session.user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserId(null)
        void navigate({ to: '/login' })
      } else if (session.user.id !== userId) {
        void loadMemberArea(session.user.id)
      }
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [navigate])

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !userId) return
    setSaving(true)
    setNotice(null)
    setError(null)
    const { error: saveError } = await supabase.from('profiles').upsert({
      id: userId,
      full_name: profile.full_name?.trim() ?? '',
      mobile: profile.mobile?.trim() ?? '',
      preferred_language: profile.preferred_language,
      preferred_currency: profile.preferred_currency,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    if (saveError) setError(saveError.message)
    else setNotice('Your account details have been saved.')
    setSaving(false)
  }

  const signOut = async () => {
    if (!supabase) return
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) setError(signOutError.message)
    else await navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          {loading ? (
            <div className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Opening your member portal…</div>
          ) : (
            <>
              <div className="flex flex-col justify-between gap-5 border-b border-border pb-8 sm:flex-row sm:items-end">
                <div>
                  <p className="eyebrow text-brass">Private member area</p>
                  <h1 className="display mt-3 text-[clamp(2rem,4vw,3.2rem)]">Welcome{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}</h1>
                  <p className="mt-3 text-sm text-ink-soft">{email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link to="/wallet" className="eyebrow border border-brass px-5 py-3 text-[0.6rem] transition-colors hover:bg-brass/10">My wallet</Link>
                  <button type="button" onClick={signOut} className="eyebrow border border-border px-5 py-3 text-[0.6rem] transition-colors hover:border-brass">Sign out</button>
                </div>
              </div>

              {error ? <p role="alert" className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
              {notice ? <p role="status" className="mt-6 border border-border px-4 py-3 text-sm">{notice}</p> : null}

              <div className="mt-10 grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
                <section>
                  <p className="eyebrow text-brass">Account details</p>
                  <h2 className="display mt-2 text-2xl">Your profile</h2>
                  <form onSubmit={saveProfile} className="mt-6 grid gap-4 border border-border bg-card p-6 sm:grid-cols-2">
                    <label className="block sm:col-span-2">
                      <span className="eyebrow text-[0.5rem] text-ink-soft">Full name</span>
                      <input className="mt-2 w-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-brass" value={profile.full_name ?? ''} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
                      <input type="tel" className="mt-2 w-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-brass" value={profile.mobile ?? ''} onChange={e => setProfile(p => ({ ...p, mobile: e.target.value }))} />
                    </label>
                    <label className="block">
                      <span className="eyebrow text-[0.5rem] text-ink-soft">Language</span>
                      <select className="mt-2 w-full border border-input bg-background px-4 py-3 text-sm" value={profile.preferred_language} onChange={e => setProfile(p => ({ ...p, preferred_language: e.target.value }))}>
                        <option value="en">English</option><option value="ar">العربية</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="eyebrow text-[0.5rem] text-ink-soft">Currency</span>
                      <select className="mt-2 w-full border border-input bg-background px-4 py-3 text-sm" value={profile.preferred_currency} onChange={e => setProfile(p => ({ ...p, preferred_currency: e.target.value }))}>
                        <option value="AED">AED</option><option value="OMR">OMR</option><option value="USD">USD</option><option value="EUR">EUR</option><option value="GBP">GBP</option>
                      </select>
                    </label>
                    <button disabled={saving} className="eyebrow mt-2 inline-flex items-center justify-between gap-6 bg-primary px-5 py-4 text-[0.6rem] text-primary-foreground disabled:opacity-60 sm:col-span-2">{saving ? 'Saving…' : 'Save details'}<ArrowRight /></button>
                  </form>
                </section>

                <section>
                  <p className="eyebrow text-brass">Your updates</p>
                  <h2 className="display mt-2 text-2xl">Notifications</h2>
                  <div className="mt-6 divide-y divide-border border-y border-border">
                    {notifications.length ? notifications.map(item => (
                      <article key={item.id} className="py-4">
                        <p className="text-sm font-medium">{item.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-soft">{item.body}</p>
                        <p className="mt-2 text-[0.65rem] text-ink-soft">{new Date(item.created_at).toLocaleDateString()}</p>
                      </article>
                    )) : <p className="py-5 text-sm text-ink-soft">You don't have any notifications yet.</p>}
                  </div>
                </section>
              </div>

              <section className="mt-14">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div><p className="eyebrow text-brass">Discover</p><h2 className="display mt-2 text-2xl">Featured residences</h2></div>
                  <Link to="/projects" className="eyebrow inline-flex items-center gap-3 text-[0.6rem] underline decoration-brass underline-offset-4">Explore all projects <ArrowRight /></Link>
                </div>
                {properties.length ? (
                  <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {properties.map(property => (
                      <article key={property.id} className="overflow-hidden border border-border bg-card">
                        {property.cover_image_url ? <img src={property.cover_image_url} alt={property.name} className="aspect-[4/3] w-full object-cover" /> : <div className="aspect-[4/3] bg-primary/10" />}
                        <div className="p-5">
                          <p className="eyebrow text-brass">{property.location ?? 'Dubai'}</p>
                          <h3 className="display mt-2 text-xl">{property.name}</h3>
                          <p className="mt-2 text-sm text-ink-soft">{property.price_label}</p>
                          {property.description ? <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-ink-soft">{property.description}</p> : null}
                          <Link to="/projects" className="eyebrow mt-5 inline-flex items-center gap-3 text-[0.6rem] underline decoration-brass underline-offset-4">View residence <ArrowRight /></Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : <p className="mt-6 border border-border p-6 text-sm text-ink-soft">New residences will appear here soon.</p>}
              </section>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
