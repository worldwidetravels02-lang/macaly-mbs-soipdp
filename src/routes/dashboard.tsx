import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import { supabase } from '../lib/supabase'
import siteMetadata from '../metadata.json'
import { IMAGES } from '../data/site'
import { Wordmark } from '../components/site-chrome'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
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
  }, [navigate, userId])

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut()
    void navigate({ to: '/login' })
  }

  const projectGroups = [
    { name: 'Junior (Trial)', subtitle: 'STARTER COLLECTION', image: IMAGES.villas, available: true },
    { name: 'Senior', subtitle: 'MEMBER COLLECTION', image: IMAGES.lowrise, available: false },
    { name: 'Master', subtitle: 'PREMIUM COLLECTION', image: IMAGES.tower, available: false },
    { name: 'Expert', subtitle: 'PRIVATE COLLECTION', image: IMAGES.marinaNight, available: false },
  ]

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#171b2a]">
      <div className="flex min-h-screen">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-[#e7e6e1] bg-white px-5 py-7 transition-transform lg:static lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <Link to="/" className="mb-12 px-2"><Wordmark /></Link>
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a927f]">Workspace</p>
          <nav className="space-y-2">
            <Link to="/dashboard" className="flex items-center gap-4 rounded-xl bg-[#f3f1ed] px-4 py-3.5 text-sm font-semibold text-[#171b2a]"><span>⌂</span> Dashboard</Link>
            <Link to="/residences" className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm text-[#777b7d] hover:bg-[#f7f7f5]"><span>▦</span> Projects</Link>
            <Link to="/wallet" className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm text-[#777b7d] hover:bg-[#f7f7f5]"><span>◷</span> Orders & wallet</Link>
            <Link to="/account" className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm text-[#777b7d] hover:bg-[#f7f7f5]"><span>♙</span> Account</Link>
            <Link to="/support" className="flex items-center gap-4 rounded-xl px-4 py-3.5 text-sm text-[#777b7d] hover:bg-[#f7f7f5]"><span>♧</span> Support</Link>
          </nav>
          <div className="mt-auto border-t border-[#ecebe7] pt-5">
            <button type="button" onClick={signOut} className="flex w-full items-center gap-4 rounded-xl px-4 py-3 text-sm text-[#777b7d] hover:bg-[#f7f7f5]"><span>↪</span> Log out</button>
          </div>
        </aside>

        {mobileMenuOpen ? <button aria-label="Close navigation" className="fixed inset-0 z-30 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} /> : null}

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[88px] items-center justify-between border-b border-[#e7e6e1] bg-white/95 px-5 backdrop-blur sm:px-8 lg:px-10">
            <div className="flex items-center gap-4">
              <button type="button" aria-label="Open menu" onClick={() => setMobileMenuOpen(v => !v)} className="rounded-xl border border-[#e7e6e1] px-4 py-3 text-lg lg:hidden">☰</button>
              <p className="text-sm text-[#858585]">Workspace <span className="mx-2 text-[#c5c1b8]">/</span><span className="font-semibold text-[#171b2a]">Dashboard</span></p>
            </div>
            <div className="flex items-center gap-3 sm:gap-5">
              <label className="hidden items-center gap-3 sm:flex"><span className="text-[10px] font-semibold tracking-[0.18em] text-[#888]">CURRENCY</span>
                <select aria-label="Preferred currency" value={profile.preferred_currency} onChange={e => setProfile(p => ({ ...p, preferred_currency: e.target.value }))} className="rounded-xl border border-[#e7e6e1] bg-white px-4 py-3 text-sm font-semibold outline-none focus:border-[#b89b59]">
                  {['AED','OMR','SAR','KWD','BHD','QAR'].map(code => <option key={code}>{code}</option>)}
                </select>
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-[#e7e6e1] bg-[#fafaf8] px-3 py-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f1e9e7] font-semibold text-[#8c7443]">{(profile.full_name?.[0] || email[0] || 'M').toUpperCase()}</span>
                <span className="hidden sm:block"><span className="block max-w-32 truncate text-sm font-semibold">{profile.full_name || 'Member'}</span><span className="block text-xs text-[#858585]">Customer</span></span>
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
            {loading ? <div className="rounded-2xl border border-[#e7e6e1] bg-white p-10 text-center text-sm text-[#777]">Opening your dashboard…</div> : (
              <>
                {error ? <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
                {notice ? <p role="status" className="mb-5 rounded-xl border border-[#d9c99e] bg-[#fbf8ef] px-4 py-3 text-sm">{notice}</p> : null}

                <section className="relative overflow-hidden rounded-2xl border border-[#e7e8e1] bg-[#eaf1ed] px-7 py-10 sm:px-11 sm:py-12">
                  <div className="pointer-events-none absolute -right-16 -top-28 h-80 w-80 rounded-full bg-[#d9e4dc]/70" />
                  <div className="relative">
                    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-[#9a804b]">Member workspace</p>
                    <h1 className="display max-w-3xl text-4xl leading-tight text-[#171b2a] sm:text-5xl">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}, {profile.full_name?.split(' ')[0] || 'Member'}.</h1>
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link to="/residences" className="inline-flex items-center rounded-lg bg-[#171b2a] px-6 py-4 text-sm font-semibold text-white transition hover:bg-[#30374d]">Explore projects <ArrowRight /></Link>
                      <Link to="/account" className="inline-flex items-center rounded-lg border border-[#d8d8d2] bg-white px-6 py-4 text-sm font-semibold text-[#171b2a] hover:border-[#b89b59]">View account</Link>
                    </div>
                  </div>
                </section>

                <section className="mt-9">
                  <div className="mb-5 flex items-center justify-between">
                    <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a18a58]">Discover your workspace</p><h2 className="mt-1 text-2xl font-semibold tracking-tight">Project groups</h2></div>
                    <Link to="/residences" className="text-sm font-medium text-[#8b7445] hover:underline">View all projects →</Link>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {projectGroups.map((group, index) => (
                      <Link key={group.name} to="/residences" className="group relative isolate aspect-[1.55] overflow-hidden rounded-2xl bg-[#18202b] shadow-sm">
                        <img src={group.image} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                        <div className="absolute inset-0 bg-gradient-to-t from-[#071b1a]/95 via-[#071b1a]/15 to-black/5" />
                        {!group.available ? <div className="absolute inset-0 bg-[#111827]/25" /> : null}
                        {!group.available ? <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-xl text-[#171b2a] shadow-lg">⌑</span> : null}
                        <div className="absolute bottom-0 left-0 right-0 p-5 text-white sm:p-6">
                          <p className="text-[10px] font-semibold tracking-[0.18em] text-white/75">{group.subtitle}</p>
                          <div className="mt-1 flex items-end justify-between gap-3"><h3 className="text-xl font-semibold">{group.name}</h3><span className="text-xs text-white/80">{group.available ? 'Explore →' : 'Locked'}</span></div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

                <section className="mt-9 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[#e7e6e1] bg-white p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a18a58]">Your account</p><h2 className="mt-2 text-xl font-semibold">Account details</h2><p className="mt-2 text-sm text-[#777]">{email || 'Your member profile'}</p><Link to="/account" className="mt-4 inline-block text-sm font-semibold text-[#8b7445] underline underline-offset-4">Manage account</Link></div>
                  <div className="rounded-2xl border border-[#e7e6e1] bg-white p-6"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a18a58]">Updates</p><h2 className="mt-2 text-xl font-semibold">Notifications</h2>{notifications.length ? <div className="mt-3 space-y-2">{notifications.slice(0,2).map(item => <p key={item.id} className="text-sm text-[#777]">{item.title}</p>)}</div> : <p className="mt-2 text-sm text-[#777]">You don't have any new notifications.</p>}</div>
                </section>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
