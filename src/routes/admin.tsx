import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

type PropertyRow = {
  id: string
  slug: string
  name: string
  location: string | null
  description: string | null
  price_label: string
  cover_image_url: string | null
  status: string
}
type EnquiryRow = {
  id: string
  full_name: string
  email: string | null
  mobile: string
  message: string | null
  source: string
  status: string
  created_at: string
}
type PromotionRow = {
  id: string
  title: string
  description: string | null
  active: boolean
}
type WalletRequestRow = {
  id: string
  user_id: string
  request_type: 'deposit' | 'withdrawal'
  amount: number
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

const meta = siteMetadata['/admin']

export const Route = createFileRoute('/admin')({
  head: () => {
    const canonical = canonicalUrl('/admin')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'robots', content: 'noindex' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const [session, setSession] = useState<Session | null>(null)
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [properties, setProperties] = useState<PropertyRow[]>([])
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([])
  const [promotions, setPromotions] = useState<PromotionRow[]>([])
  const [walletRequests, setWalletRequests] = useState<WalletRequestRow[]>([])
  const [section, setSection] = useState<'overview' | 'properties' | 'enquiries' | 'promotions' | 'wallet'>('overview')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [propertyForm, setPropertyForm] = useState({ slug: '', name: '', location: 'Dubai, UAE', description: '', price_label: '', cover_image_url: '', status: 'published' })
  const [promotionForm, setPromotionForm] = useState({ title: '', description: '' })

  const loadAdminData = useCallback(async () => {
    if (!supabase) {
      setError('Supabase is not configured. Add the public Supabase URL and anon key to the deployment environment.')
      setChecking(false)
      return
    }
    const { data: auth } = await supabase.auth.getSession()
    const current = auth.session
    setSession(current)
    if (!current) {
      setChecking(false)
      return
    }
    const { data: membership, error: membershipError } = await supabase
      .from('admin_members')
      .select('role')
      .eq('user_id', current.user.id)
      .maybeSingle()
    if (membershipError) {
      setError('Could not verify administrator access. Check the admin_members table and its row-level security policy.')
      setChecking(false)
      return
    }
    if (!membership) {
      setIsAdmin(false)
      setChecking(false)
      return
    }
    setIsAdmin(true)
    const [propertyResult, enquiryResult, promotionResult, walletResult] = await Promise.all([
      supabase.from('properties').select('id,slug,name,location,description,price_label,cover_image_url,status').order('created_at', { ascending: false }),
      supabase.from('enquiries').select('id,full_name,email,mobile,message,source,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('promotions').select('id,title,description,active').order('created_at', { ascending: false }),
      supabase.from('wallet_requests').select('id,user_id,request_type,amount,note,status,created_at').order('created_at', { ascending: false }).limit(100),
    ])
    const firstError = propertyResult.error ?? enquiryResult.error ?? promotionResult.error ?? walletResult.error
    if (firstError) setError(firstError.message)
    setProperties(propertyResult.data ?? [])
    setEnquiries(enquiryResult.data ?? [])
    setPromotions(promotionResult.data ?? [])
    setWalletRequests((walletResult.data ?? []) as WalletRequestRow[])
    setChecking(false)
  }, [])

  useEffect(() => {
    void loadAdminData()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      void loadAdminData()
    })
    return () => data.subscription.unsubscribe()
  }, [loadAdminData])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
    if (signInError) setError(signInError.message)
    else await loadAdminData()
    setBusy(false)
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setSession(null); setIsAdmin(false)
  }

  const saveProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !isAdmin) return
    setBusy(true); setError(null); setNotice(null)
    const { error: saveError } = await supabase.from('properties').insert({
      ...propertyForm,
      slug: propertyForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    })
    if (saveError) setError(saveError.message)
    else {
      setNotice('Property saved.')
      setPropertyForm({ slug: '', name: '', location: 'Dubai, UAE', description: '', price_label: '', cover_image_url: '', status: 'published' })
      await loadAdminData()
    }
    setBusy(false)
  }

  const updateEnquiry = async (id: string, status: string) => {
    if (!supabase || !isAdmin) return
    const { error: updateError } = await supabase.from('enquiries').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else await loadAdminData()
  }

  const reviewWalletRequest = async (id: string, decision: 'approved' | 'rejected') => {
    if (!supabase || !isAdmin) return
    setBusy(true); setError(null); setNotice(null)
    const { error: reviewError } = await supabase.rpc('review_wallet_request', {
      p_request_id: id,
      p_decision: decision,
      p_admin_note: null,
    })
    if (reviewError) setError(reviewError.message)
    else {
      setNotice('Wallet request ' + decision + '.')
      await loadAdminData()
    }
    setBusy(false)
  }

  const savePromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !isAdmin) return
    setBusy(true); setError(null); setNotice(null)
    const { error: saveError } = await supabase.from('promotions').insert({ ...promotionForm, active: true })
    if (saveError) setError(saveError.message)
    else {
      setNotice('Promotion published.')
      setPromotionForm({ title: '', description: '' })
      await loadAdminData()
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-5 border-b border-border pb-8">
            <div><p className="eyebrow text-brass">Private workspace</p><h1 className="display mt-3 text-4xl">Administration</h1><p className="mt-3 text-sm text-ink-soft">Manage Msheireb Properties content and customer enquiries.</p></div>
            {session ? <button onClick={signOut} className="eyebrow border border-border px-5 py-3 text-xs">Sign out</button> : null}
          </div>
          {error ? <p role="alert" className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" className="mt-6 border border-brass/40 bg-brass/5 px-4 py-3 text-sm">{notice}</p> : null}
          {checking ? <p className="py-12 text-sm text-ink-soft">Checking administrator access…</p> : !session ? (
            <form onSubmit={signIn} className="mt-10 grid max-w-md gap-4 border border-border bg-card p-6">
              <h2 className="display text-2xl">Administrator sign in</h2>
              <label className="text-sm">Email<input name="email" type="email" required autoComplete="username" className="mt-2 w-full border border-input bg-background px-4 py-3" /></label>
              <label className="text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="mt-2 w-full border border-input bg-background px-4 py-3" /></label>
              <button disabled={busy} className="eyebrow bg-primary px-5 py-4 text-primary-foreground">{busy ? 'Signing in…' : 'Sign in'}</button>
              <Link to="/login" className="text-sm underline">Member login</Link>
            </form>
          ) : !isAdmin ? (
            <section className="mt-10 max-w-2xl border border-border bg-card p-8">
              <h2 className="display text-2xl">Administrator access not assigned</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">Your account is signed in, but it is not listed in admin_members. For security, the first administrator must be added by the project owner in the Supabase SQL Editor. Do not make admin access available through public registration.</p>
              <p className="mt-4 text-xs text-ink-soft">Signed-in account: {session.user.email}</p>
            </section>
          ) : (
            <>
              <nav className="mt-8 flex flex-wrap gap-2">
                {(['overview','properties','enquiries','promotions','wallet'] as const).map(item => <button key={item} onClick={() => setSection(item)} className={section===item ? 'eyebrow bg-primary px-4 py-3 text-primary-foreground' : 'eyebrow border border-border px-4 py-3'}>{item}</button>)}
              </nav>
              {section === 'overview' ? <div className="mt-8 grid gap-4 sm:grid-cols-3">{[{label:'Properties',value:properties.length},{label:'Enquiries',value:enquiries.length},{label:'Promotions',value:promotions.length}].map(item => <div key={item.label} className="border border-border bg-card p-6"><p className="eyebrow text-ink-soft">{item.label}</p><p className="display mt-3 text-4xl">{item.value}</p></div>)}</div> : null}
              {section === 'properties' ? <section className="mt-8 grid gap-8 lg:grid-cols-2"><form onSubmit={saveProperty} className="grid content-start gap-3 border border-border bg-card p-6"><h2 className="display text-2xl">Add property</h2>{([['slug','URL slug'],['name','Property name'],['location','Location'],['price_label','Price label'],['cover_image_url','Cover image URL']] as const).map(([name,label])=><label key={name} className="text-sm">{label}<input required={name!=='cover_image_url'} value={propertyForm[name]} onChange={e=>setPropertyForm(p=>({...p,[name]:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2" /></label>)}<label className="text-sm">Description<textarea value={propertyForm.description} onChange={e=>setPropertyForm(p=>({...p,description:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2" rows={3}/></label><button disabled={busy} className="eyebrow bg-primary px-5 py-3 text-primary-foreground">Save property</button></form><div><h2 className="display text-2xl">Current properties</h2><div className="mt-4 divide-y divide-border border-y border-border">{properties.map(p=><article key={p.id} className="py-4"><p className="font-medium">{p.name}</p><p className="mt-1 text-xs text-ink-soft">{p.location} · {p.price_label} · {p.status}</p></article>)}</div></div></section> : null}
              {section === 'enquiries' ? <section className="mt-8"><h2 className="display text-2xl">Customer enquiries</h2><div className="mt-4 divide-y divide-border border-y border-border">{enquiries.map(item=><article key={item.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto]"><div><p className="font-medium">{item.full_name}</p><p className="mt-1 text-sm text-ink-soft">{item.mobile} · {item.email ?? 'No email'}</p><p className="mt-2 text-sm">{item.message}</p><p className="mt-2 text-xs text-ink-soft">{item.source} · {new Date(item.created_at).toLocaleString()}</p></div><select value={item.status} onChange={e=>void updateEnquiry(item.id,e.target.value)} className="h-fit border border-input bg-background px-3 py-2 text-sm"><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="closed">Closed</option></select></article>)}</div></section> : null}
              {section === 'wallet' ? <section className="mt-8"><h2 className="display text-2xl">Wallet requests</h2><p className="mt-2 text-sm text-ink-soft">Approve or reject customer requests. Approval updates the member wallet balance through a protected Supabase function.</p><div className="mt-5 divide-y divide-border border-y border-border">{walletRequests.length ? walletRequests.map(item=><article key={item.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto]"><div><p className="font-medium capitalize">{item.request_type} · AED {Number(item.amount).toLocaleString('en-AE',{minimumFractionDigits:2,maximumFractionDigits:2})}</p><p className="mt-1 break-all text-xs text-ink-soft">Customer ID: {item.user_id}</p><p className="mt-1 text-xs text-ink-soft">{new Date(item.created_at).toLocaleString()} · {item.status}</p>{item.note?<p className="mt-2 text-sm">{item.note}</p>:null}</div>{item.status==='pending'?<div className="flex gap-2"><button disabled={busy} onClick={()=>void reviewWalletRequest(item.id,'approved')} className="eyebrow bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">Approve</button><button disabled={busy} onClick={()=>void reviewWalletRequest(item.id,'rejected')} className="eyebrow border border-border px-3 py-2 disabled:opacity-50">Reject</button></div>:<span className="h-fit border border-border px-3 py-2 text-xs capitalize">{item.status}</span>}</article>):<p className="py-6 text-sm text-ink-soft">No wallet requests yet.</p>}</div></section> : null}
              {section === 'promotions' ? <section className="mt-8 grid gap-8 lg:grid-cols-2"><form onSubmit={savePromotion} className="grid content-start gap-3 border border-border bg-card p-6"><h2 className="display text-2xl">Publish promotion</h2><label className="text-sm">Title<input required value={promotionForm.title} onChange={e=>setPromotionForm(p=>({...p,title:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2"/></label><label className="text-sm">Description<textarea value={promotionForm.description} onChange={e=>setPromotionForm(p=>({...p,description:e.target.value}))} rows={3} className="mt-1 w-full border border-input bg-background px-3 py-2"/></label><button disabled={busy} className="eyebrow bg-primary px-5 py-3 text-primary-foreground">Publish promotion</button></form><div><h2 className="display text-2xl">Current promotions</h2><div className="mt-4 divide-y divide-border border-y border-border">{promotions.map(p=><article key={p.id} className="py-4"><p className="font-medium">{p.title}</p><p className="mt-1 text-sm text-ink-soft">{p.description} · {p.active?'Active':'Inactive'}</p></article>)}</div></div></section> : null}
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
