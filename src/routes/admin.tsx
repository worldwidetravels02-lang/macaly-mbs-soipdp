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
type BadgeRow = { id: string; level: 'Senior' | 'Master' | 'Expert'; badge_number: number; title: string; icon: string; is_locked: boolean }
type BadgeAssignmentRow = { id: string; badge_id: string; property_id: string; position: number }
type MemberOrderRow = { id: string; user_id: string; badge_id: string; property_id: string; status: 'ordered' | 'completed' | 'cancelled'; ordered_at: string }
type CustomerRow = { id: string; full_name: string | null; mobile: string | null }
type MemberProgressRow = { id: string; user_id: string; badge_id: string; status: 'locked' | 'unlocked' | 'support_requested' | 'completed' }
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
  const [badges, setBadges] = useState<BadgeRow[]>([])
  const [badgeAssignments, setBadgeAssignments] = useState<BadgeAssignmentRow[]>([])
  const [memberOrders, setMemberOrders] = useState<MemberOrderRow[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [memberProgress, setMemberProgress] = useState<MemberProgressRow[]>([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [selectedLevel, setSelectedLevel] = useState<'Senior' | 'Master' | 'Expert'>('Senior')
  const [selectedBadgeId, setSelectedBadgeId] = useState('')
  const [section, setSection] = useState<'overview' | 'properties' | 'enquiries' | 'promotions' | 'wallet' | 'badges'>('overview')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [propertyForm, setPropertyForm] = useState({ slug: '', name: '', location: 'Dubai, UAE', description: '', price_label: '', cover_image_url: '', status: 'published' })
  const [editingPropertyId, setEditingPropertyId] = useState<string | null>(null)
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
    const [propertyResult, enquiryResult, promotionResult, walletResult, badgeResult, assignmentResult, orderResult, customerResult, progressResult] = await Promise.all([
      supabase.from('properties').select('id,slug,name,location,description,price_label,cover_image_url,status').order('created_at', { ascending: false }),
      supabase.from('enquiries').select('id,full_name,email,mobile,message,source,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('promotions').select('id,title,description,active').order('created_at', { ascending: false }),
      supabase.from('wallet_requests').select('id,user_id,request_type,amount,note,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.from('project_badges').select('id,level,badge_number,title,icon,is_locked').order('level').order('badge_number'),
      supabase.from('project_badge_properties').select('id,badge_id,property_id,position').order('position'),
      supabase.from('member_project_orders').select('id,user_id,badge_id,property_id,status,ordered_at').order('ordered_at', { ascending: false }).limit(200),
      supabase.from('profiles').select('id,full_name,mobile').order('created_at', { ascending: false }).limit(500),
      supabase.from('member_badge_progress').select('id,user_id,badge_id,status'),
    ])
    const firstError = propertyResult.error ?? enquiryResult.error ?? promotionResult.error ?? walletResult.error ?? badgeResult.error ?? assignmentResult.error ?? orderResult.error ?? customerResult.error ?? progressResult.error
    if (firstError) setError(firstError.message)
    setProperties(propertyResult.data ?? [])
    setEnquiries(enquiryResult.data ?? [])
    setPromotions(promotionResult.data ?? [])
    setWalletRequests((walletResult.data ?? []) as WalletRequestRow[])
    setBadges((badgeResult.data ?? []) as BadgeRow[])
    setBadgeAssignments((assignmentResult.data ?? []) as BadgeAssignmentRow[])
    setMemberOrders((orderResult.data ?? []) as MemberOrderRow[])
    setCustomers((customerResult.data ?? []) as CustomerRow[])
    setMemberProgress((progressResult.data ?? []) as MemberProgressRow[])
    if (!selectedCustomerId && customerResult.data?.length) setSelectedCustomerId(customerResult.data[0].id)
    if (!selectedBadgeId && badgeResult.data?.length) setSelectedBadgeId(badgeResult.data[0].id)
    setChecking(false)
  }, [])

  useEffect(() => {
    void loadAdminData()
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      // Keep the displayed session in sync. Do not run Supabase queries inside
      // this callback; doing so can block auth state processing.
      setSession(nextSession)
    })
    return () => data.subscription.unsubscribe()
  }, [loadAdminData])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError(null)
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: String(form.get('email') ?? '').trim(),
      password: String(form.get('password') ?? ''),
    })
    if (signInError) {
      setError(signInError.message)
    } else {
      // Show the authenticated session immediately, then load admin membership/data.
      setSession(signInData.session)
      await loadAdminData()
    }
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
    const values = {
      ...propertyForm,
      slug: propertyForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    }
    const query = editingPropertyId
      ? supabase.from('properties').update(values).eq('id', editingPropertyId)
      : supabase.from('properties').insert(values)
    const { error: saveError } = await query
    if (saveError) setError(saveError.message)
    else {
      setNotice('Property saved.')
      setPropertyForm({ slug: '', name: '', location: 'Dubai, UAE', description: '', price_label: '', cover_image_url: '', status: 'published' })
      setEditingPropertyId(null)
      await loadAdminData()
    }
    setBusy(false)
  }

  const editProperty = (property: PropertyRow) => {
    setEditingPropertyId(property.id)
    setPropertyForm({
      slug: property.slug,
      name: property.name,
      location: property.location ?? '',
      description: property.description ?? '',
      price_label: property.price_label,
      cover_image_url: property.cover_image_url ?? '',
      status: property.status,
    })
    setNotice('Editing ' + property.name + '.')
    setError(null)
  }

  const updatePropertyStatus = async (id: string, status: string) => {
    if (!supabase || !isAdmin) return
    const { error: updateError } = await supabase.from('properties').update({ status }).eq('id', id)
    if (updateError) setError(updateError.message)
    else { setNotice('Property status updated.'); await loadAdminData() }
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

  const assignCustomerLevel = async () => {
    if (!supabase || !isAdmin || !selectedCustomerId) return
    const levelBadges = badges.filter(item => item.level === selectedLevel).sort((a,b)=>a.badge_number-b.badge_number)
    if (levelBadges.length !== 3) { setError('The three badge definitions for this level are missing. Apply the badge migration first.'); return }
    if (memberProgress.some(item => item.user_id === selectedCustomerId)) { setError('This customer already has an assigned badge level.'); return }
    if (levelBadges[0].is_locked) { setError('Unlock Badge 1 in the badge catalogue before activating this customer level.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: insertError } = await supabase.from('member_badge_progress').insert(levelBadges.map((badge,index)=>({user_id:selectedCustomerId,badge_id:badge.id,status:index===0?'unlocked':'locked',unlocked_at:index===0?new Date().toISOString():null})))
    if (insertError) setError(insertError.message)
    else { setNotice(selectedLevel + ' level activated for customer. Badge 1 is available.'); await loadAdminData() }
    setBusy(false)
  }

  const approveBadgeUnlock = async (progressRow: MemberProgressRow) => {
    if (!supabase || !isAdmin || progressRow.status !== 'support_requested') return
    const badge = badges.find(item=>item.id===progressRow.badge_id)
    if (!badge || badge.is_locked) { setError('Unlock this badge in the badge catalogue first.'); return }
    if (badge.badge_number > 1) {
      const previousBadge = badges.find(item => item.level === badge.level && item.badge_number === badge.badge_number - 1)
      const previousProgress = previousBadge && memberProgress.find(item => item.user_id === progressRow.user_id && item.badge_id === previousBadge.id)
      if (!previousProgress || previousProgress.status !== 'completed') {
        setError('The customer must complete the previous badge before this badge can be approved.')
        return
      }
    }
    const assignedCount = badgeAssignments.filter(item => item.badge_id===badge.id).length
    if (assignedCount !== 20) { setError('Assign exactly 20 properties to this badge before approving.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: updateError } = await supabase.from('member_badge_progress').update({status:'unlocked',unlocked_at:new Date().toISOString()}).eq('id',progressRow.id)
    if (updateError) setError(updateError.message)
    else { setNotice('Next badge unlocked for customer.'); await loadAdminData() }
    setBusy(false)
  }

  const updateMemberOrder = async (order: MemberOrderRow, status: 'completed' | 'cancelled') => {
    if (!supabase || !isAdmin) return
    setBusy(true); setError(null); setNotice(null)
    const { error: updateError } = await supabase.from('member_project_orders').update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null }).eq('id', order.id)
    if (updateError) setError(updateError.message)
    else { setNotice('Customer property order marked ' + status + '.'); await loadAdminData() }
    setBusy(false)
  }

  const toggleBadgeLock = async (badge: BadgeRow) => {
    if (!supabase || !isAdmin) return
    const count = badgeAssignments.filter(item => item.badge_id === badge.id).length
    if (badge.is_locked && count !== 20) { setError('Assign exactly 20 properties before unlocking this badge.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: updateError } = await supabase.from('project_badges').update({ is_locked: !badge.is_locked }).eq('id', badge.id)
    if (updateError) setError(updateError.message)
    else { setNotice(badge.is_locked ? 'Badge unlocked.' : 'Badge locked.'); await loadAdminData() }
    setBusy(false)
  }

  const assignBadgeProperty = async (propertyId: string) => {
    if (!supabase || !isAdmin || !selectedBadgeId) return
    const badge = badges.find(item => item.id === selectedBadgeId)
    if (!badge) return
    const inBadge = badgeAssignments.filter(item => item.badge_id === badge.id)
    if (inBadge.length >= 20) { setError('This badge already has 20 properties.'); return }
    const duplicateInLevel = badgeAssignments.some(item => item.property_id === propertyId && badges.find(b => b.id === item.badge_id)?.level === badge.level)
    if (duplicateInLevel) { setError('This property is already assigned to another badge in this level.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: insertError } = await supabase.from('project_badge_properties').insert({ badge_id: badge.id, property_id: propertyId, position: inBadge.length + 1 })
    if (insertError) setError(insertError.message)
    else { setNotice('Property assigned to ' + badge.level + ' ' + badge.title + '.'); await loadAdminData() }
    setBusy(false)
  }

  const removeBadgeProperty = async (assignment: BadgeAssignmentRow) => {
    if (!supabase || !isAdmin) return
    setBusy(true); setError(null); setNotice(null)
    const { error: deleteError } = await supabase.from('project_badge_properties').delete().eq('id', assignment.id)
    if (deleteError) setError(deleteError.message)
    else { setNotice('Property removed from badge.'); await loadAdminData() }
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
                {(['overview','properties','enquiries','promotions','wallet','badges'] as const).map(item => <button key={item} onClick={() => setSection(item)} className={section===item ? 'eyebrow bg-primary px-4 py-3 text-primary-foreground' : 'eyebrow border border-border px-4 py-3'}>{item}</button>)}
              </nav>
              {section === 'badges' ? <section className="mt-8"><h2 className="display text-2xl">Senior · Master · Expert badges</h2><p className="mt-2 text-sm text-ink-soft">Each badge contains 20 properties. Junior Trial is not included here.</p><div className="mt-5 flex flex-wrap gap-2">{badges.map(badge => <button key={badge.id} type="button" onClick={() => setSelectedBadgeId(badge.id)} className={selectedBadgeId===badge.id ? 'border border-primary bg-primary px-4 py-3 text-sm text-primary-foreground' : 'border border-border px-4 py-3 text-sm'}>{badge.level} · {badge.title}</button>)}</div>{(() => { const badge = badges.find(item => item.id === selectedBadgeId); if (!badge) return <p className="mt-6 text-sm text-ink-soft">Badge definitions are not available. Apply the badge database migration before using this section.</p>; const assigned = badgeAssignments.filter(item => item.badge_id === badge.id).sort((a,b)=>a.position-b.position); const assignedIds = new Set(badgeAssignments.filter(item => badges.find(b=>b.id===item.badge_id)?.level===badge.level).map(item=>item.property_id)); const available = properties.filter(item=>item.status==='published' && !assignedIds.has(item.id)); return <div className="mt-6 grid gap-6 lg:grid-cols-2"><div className="border border-border bg-card p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow text-brass">{badge.level}</p><h3 className="display mt-1 text-2xl">{badge.title}</h3><p className="mt-1 text-sm text-ink-soft">{badge.icon} icon · {assigned.length}/20 properties</p></div><div className="mt-4 grid w-full grid-cols-2 gap-3 sm:mt-0 sm:w-auto"><button type="button" disabled={busy || badge.is_locked} onClick={()=>void toggleBadgeLock(badge)} className="min-h-12 border-2 border-border bg-background px-4 py-3 text-sm font-semibold disabled:opacity-40">Lock badge</button><button type="button" disabled={busy || !badge.is_locked || assigned.length!==20} onClick={()=>void toggleBadgeLock(badge)} className="min-h-12 border-2 border-primary bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">Unlock badge</button></div></div><div className="mt-5"><label className="text-sm">Add a published property<select disabled={busy || available.length===0} defaultValue="" onChange={e=>{if(e.target.value) void assignBadgeProperty(e.target.value); e.target.value=''}} className="mt-2 w-full border border-input bg-background px-3 py-3"><option value="">{available.length ? 'Choose property…' : 'No available properties'}</option>{available.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><p className="mt-2 text-xs text-ink-soft">A property can only appear once within each level. Badges cannot be unlocked until all 20 positions are assigned.</p></div></div><div><h3 className="display text-xl">Assigned properties</h3><div className="mt-3 divide-y divide-border border-y border-border">{assigned.map((item,index)=>{const property=properties.find(p=>p.id===item.property_id);return <article key={item.id} className="flex items-center justify-between gap-3 py-3"><div><p className="text-xs text-ink-soft">Order {String(index+1).padStart(2, '0')} of 20</p><p className="text-sm font-medium">{property?.name ?? 'Property not found'}</p></div><button type="button" disabled={busy || !badge.is_locked} onClick={()=>void removeBadgeProperty(item)} className="border border-border px-3 py-2 text-xs disabled:opacity-40">Remove</button></article>})}{!assigned.length?<p className="py-5 text-sm text-ink-soft">No properties assigned yet.</p>:null}</div></div></div> })()}</section> : null}
              {section === 'badges' ? <section className="mt-12"><h2 className="display text-2xl">Assign customer level</h2><p className="mt-2 text-sm text-ink-soft">Choose a customer and activate Senior, Master or Expert. Badge 1 must be unlocked and the customer receives three progress records for that level.</p><div className="mt-4 grid gap-3 border border-border bg-card p-5 sm:grid-cols-[1fr_180px_auto]"><select value={selectedCustomerId} onChange={e=>setSelectedCustomerId(e.target.value)} className="border border-input bg-background px-3 py-3"><option value="">Choose customer…</option>{customers.map(customer=><option key={customer.id} value={customer.id}>{customer.full_name || customer.mobile || customer.id.slice(0,8)} · {customer.id.slice(0,8)}</option>)}</select><select value={selectedLevel} onChange={e=>setSelectedLevel(e.target.value as 'Senior'|'Master'|'Expert')} className="border border-input bg-background px-3 py-3"><option>Senior</option><option>Master</option><option>Expert</option></select><button type="button" disabled={busy || !selectedCustomerId} onClick={()=>void assignCustomerLevel()} className="eyebrow bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">Activate level</button></div><h2 className="display mt-10 text-2xl">Pending badge unlock approvals</h2><div className="mt-4 divide-y divide-border border-y border-border">{memberProgress.filter(item=>item.status==='support_requested').map(item=>{const customer=customers.find(row=>row.id===item.user_id);const badge=badges.find(row=>row.id===item.badge_id);return <article key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="font-medium">{customer?.full_name || customer?.mobile || 'Customer'} · {badge?.level} {badge?.title}</p><p className="break-all text-xs text-ink-soft">Customer ID: {item.user_id}</p></div><button type="button" disabled={busy || (()=>{const badge=badges.find(row=>row.id===item.badge_id);if(!badge || badge.badge_number===1)return false;const previous=badges.find(row=>row.level===badge.level && row.badge_number===badge.badge_number-1);return !previous || memberProgress.find(row=>row.user_id===item.user_id && row.badge_id===previous.id)?.status!=='completed'})()} onClick={()=>void approveBadgeUnlock(item)} className="eyebrow bg-primary px-4 py-3 text-primary-foreground disabled:opacity-50">Approve & unlock</button></article>})}{!memberProgress.some(item=>item.status==='support_requested')?<p className="py-5 text-sm text-ink-soft">No pending badge unlock requests.</p>:null}</div><h2 className="display mt-10 text-2xl">Customer badge progress</h2><p className="mt-2 text-sm text-ink-soft">Progress for every customer assigned to Senior, Master or Expert.</p><div className="mt-4 divide-y divide-border border-y border-border">{memberProgress.map(item=>{const customer=customers.find(row=>row.id===item.user_id);const badge=badges.find(row=>row.id===item.badge_id);const completed=memberOrders.filter(order=>order.user_id===item.user_id && order.badge_id===item.badge_id && order.status==='completed').length;return <article key={item.id} className="grid gap-2 py-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-medium">{customer?.full_name || customer?.mobile || 'Customer'} · {badge?.level ?? 'Level'} · {badge?.title ?? 'Badge'}</p><p className="mt-1 break-all text-xs text-ink-soft">Customer ID: {item.user_id}</p></div><div className="text-sm sm:text-right"><p className="font-semibold">{completed} of 20 completed</p><p className="mt-1 text-xs capitalize text-ink-soft">{item.status.replace('_',' ')}</p></div></article>})}{!memberProgress.length?<p className="py-5 text-sm text-ink-soft">No customer badge progress yet.</p>:null}</div><h2 className="display mt-10 text-2xl">Customer property orders</h2><p className="mt-2 text-sm text-ink-soft">Mark each customer property order completed after your review. Completing all 20 orders triggers the badge achievement.</p><div className="mt-4 divide-y divide-border border-y border-border">{memberOrders.length ? memberOrders.map(order=>{const property=properties.find(item=>item.id===order.property_id);const badge=badges.find(item=>item.id===order.badge_id);return <article key={order.id} className="grid gap-3 py-4 sm:grid-cols-[1fr_auto]"><div><p className="font-medium">{property?.name ?? 'Property'} · {badge?.level ?? 'Level'} {badge?.title ?? 'Badge'}</p><p className="mt-1 break-all text-xs text-ink-soft">Customer ID: {order.user_id}</p><p className="mt-1 text-xs text-ink-soft">{new Date(order.ordered_at).toLocaleString()} · {order.status}</p></div>{order.status==='ordered'?<div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>void updateMemberOrder(order,'completed')} className="eyebrow bg-primary px-3 py-2 text-primary-foreground disabled:opacity-50">Mark completed</button><button type="button" disabled={busy} onClick={()=>void updateMemberOrder(order,'cancelled')} className="eyebrow border border-border px-3 py-2 disabled:opacity-50">Cancel</button></div>:<span className="h-fit border border-border px-3 py-2 text-xs capitalize">{order.status}</span>}</article>}) : <p className="py-6 text-sm text-ink-soft">No customer property orders yet.</p>}</div></section> : null}
              {section === 'overview' ? <div className="mt-8 grid gap-4 sm:grid-cols-3">{[{label:'Properties',value:properties.length},{label:'Enquiries',value:enquiries.length},{label:'Promotions',value:promotions.length}].map(item => <div key={item.label} className="border border-border bg-card p-6"><p className="eyebrow text-ink-soft">{item.label}</p><p className="display mt-3 text-4xl">{item.value}</p></div>)}</div> : null}
              {section === 'properties' ? <section className="mt-8 grid gap-8 lg:grid-cols-2"><form onSubmit={saveProperty} className="grid content-start gap-3 border border-border bg-card p-6"><h2 className="display text-2xl">{editingPropertyId ? 'Edit property' : 'Add property'}</h2>{([['slug','URL slug'],['name','Property name'],['location','Location'],['price_label','Price label'],['cover_image_url','Cover image URL']] as const).map(([name,label])=><label key={name} className="text-sm">{label}<input required={name!=='cover_image_url'} value={propertyForm[name]} onChange={e=>setPropertyForm(p=>({...p,[name]:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2" /></label>)}<label className="text-sm">Description<textarea value={propertyForm.description} onChange={e=>setPropertyForm(p=>({...p,description:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2" rows={3}/></label><label className="text-sm">Visibility<select value={propertyForm.status} onChange={e=>setPropertyForm(p=>({...p,status:e.target.value}))} className="mt-1 w-full border border-input bg-background px-3 py-2"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select></label><button disabled={busy} className="eyebrow bg-primary px-5 py-3 text-primary-foreground">{busy ? 'Saving…' : editingPropertyId ? 'Update property' : 'Save property'}</button>{editingPropertyId ? <button type="button" onClick={()=>{setEditingPropertyId(null);setPropertyForm({slug:'',name:'',location:'Dubai, UAE',description:'',price_label:'',cover_image_url:'',status:'published'});setNotice(null)}} className="eyebrow border border-border px-5 py-3">Cancel edit</button> : null}</form><div><h2 className="display text-2xl">Current properties</h2><div className="mt-4 divide-y divide-border border-y border-border">{properties.map(p=><article key={p.id} className="py-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{p.name}</p><p className="mt-1 text-xs text-ink-soft">{p.location} · {p.price_label}</p></div><div className="flex items-center gap-2"><select aria-label={'Visibility for '+p.name} value={p.status} onChange={e=>void updatePropertyStatus(p.id,e.target.value)} className="border border-input bg-background px-2 py-2 text-xs"><option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option></select><button type="button" onClick={()=>editProperty(p)} className="eyebrow border border-border px-3 py-2 text-xs">Edit</button></div></div></article>)}</div></div></section> : null}
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
