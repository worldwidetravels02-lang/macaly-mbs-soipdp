import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { errorMessage } from '../lib/errors'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

type Row = Record<string, any>
type Section = 'overview' | 'properties' | 'enquiries' | 'users' | 'promotions' | 'finance' | 'investments' | 'verifications' | 'crypto' | 'tasks' | 'payments' | 'content' | 'team' | 'support' | 'settings'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'users', label: 'Customers' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'finance', label: 'Wallet & finance' },
  { id: 'investments', label: 'Investments' },
  { id: 'verifications', label: 'Identity checks' },
  { id: 'crypto', label: 'Crypto payments' },
  { id: 'tasks', label: 'Tasks & levels' },
  { id: 'payments', label: 'Payment records' },
  { id: 'content', label: 'Content & journal' },
  { id: 'team', label: 'Administrators' },
  { id: 'support', label: 'Support' },
  { id: 'settings', label: 'Settings' },
]
const CURRENCIES = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR']
const meta = siteMetadata['/admin']
const money = (value: unknown, currency = 'AED') => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—'
const text = (value: unknown) => String(value ?? '')
const inputClass = 'w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-brass'
const buttonClass = 'eyebrow inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.56rem] text-primary-foreground disabled:opacity-50'
const softButton = 'eyebrow border border-border px-4 py-2.5 text-[0.52rem] transition-colors hover:border-brass disabled:opacity-50'

export const Route = createFileRoute('/admin')({
  head: () => {
    const canonical = canonicalUrl('/admin')
    return {
      meta: [{ title: meta.title }, { name: 'description', content: meta.description }, { name: 'robots', content: 'noindex' }],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState<Section>('overview')
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [propertyDraft, setPropertyDraft] = useState({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' })
  const [editingPropertyId, setEditingPropertyId] = useState('')
  const [promotionDraft, setPromotionDraft] = useState({ title: '', description: '', image_url: '', active: false })
  const [editingPromotionId, setEditingPromotionId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [profileCustomerId, setProfileCustomerId] = useState('')
  const [profileAddress, setProfileAddress] = useState('')
  const [profileInterest, setProfileInterest] = useState('')
  const [profileLevel, setProfileLevel] = useState('0')
  const [notificationDraft, setNotificationDraft] = useState({ user_id: '', title: '', body: '' })
  const [profitDraft, setProfitDraft] = useState({ user_id: '', amount: '', currency: 'AED', period_start: '', period_end: '', description: 'Monthly profit credited to customer wallet' })
  const [selectedThread, setSelectedThread] = useState('')
  const [reply, setReply] = useState('')
  const [postDraft, setPostDraft] = useState({ title: '', slug: '', category: 'News', excerpt: '', content: '', cover_image_url: '', author_name: 'Msheireb Properties' })
  const [paymentDetailsDraft, setPaymentDetailsDraft] = useState({ bank_name: '', account_name: '', account_number: '', iban: '', swift: '', note: '', crypto: '[]' })
  const [fxDrafts, setFxDrafts] = useState<Record<string, string>>({})
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [planDrafts, setPlanDrafts] = useState<Record<string, { name: string; minimum_amount: string; profit_percent: string; commission_percent: string }>>({})

  const load = useCallback(async () => {
    setChecking(true)
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      setUser(auth.user)
      if (!auth.user) { setAuthorized(false); return }
      const { data: membership, error: membershipError } = await client.from('admin_members').select('role').eq('user_id', auth.user.id).maybeSingle()
      if (membershipError || !membership) { setAuthorized(false); return }
      setAuthorized(true)
      const queries: Record<string, PromiseLike<any>> = {
        properties: client.from('properties').select('*').order('created_at', { ascending: false }),
        enquiries: client.from('enquiries').select('*,properties(name)').order('created_at', { ascending: false }).limit(100),
        users: client.from('profiles').select('id,full_name,mobile,preferred_currency,preferred_language,created_at').order('created_at', { ascending: false }).limit(200),
        promotions: client.from('promotions').select('*').order('created_at', { ascending: false }),
        topups: client.from('topup_requests').select('*').order('created_at', { ascending: false }).limit(100),
        withdrawals: client.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(100),
        investments: client.from('investments').select('*').order('created_at', { ascending: false }).limit(100),
        profits: client.from('profit_payouts').select('*').order('created_at', { ascending: false }).limit(100),
        threads: client.from('support_threads').select('*').order('updated_at', { ascending: false }).limit(100),
        fx: client.from('fx_rates').select('*').order('code'),
        prices: client.from('property_prices').select('*').order('slug'),
        plans: client.from('membership_plans').select('*').order('level'),
        investmentRequests: client.from('investment_requests').select('*').order('created_at', { ascending: false }).limit(100),
        verifications: client.from('verifications').select('*').order('submitted_at', { ascending: false }).limit(100),
        cryptoPayments: client.from('crypto_payments').select('*').order('created_at', { ascending: false }).limit(100),
        tasks: client.from('member_tasks').select('*').order('created_at', { ascending: false }).limit(100),
        payments: client.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
        reservationDeposits: client.from('reservation_deposits').select('*').order('created_at', { ascending: false }).limit(100),
        posts: client.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
        admins: client.from('admin_members').select('*').order('created_at', { ascending: false }),
        accounts: client.from('account_states').select('*'),
        paymentDetails: client.from('payment_details').select('*').order('updated_at', { ascending: false }),
        memberProfiles: client.from('member_profiles').select('*').order('created_at', { ascending: false }).limit(200),
        notifications: client.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        financialAudit: client.from('financial_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      }
      const names = Object.keys(queries)
      const results = await Promise.all(names.map((name) => queries[name]))
      const next: Record<string, Row[]> = {}
      results.forEach((result, index) => {
        if (result.error) throw result.error
        next[names[index]] = (result.data ?? []) as Row[]
      })
      setRows(next)
      setFxDrafts(Object.fromEntries((next.fx ?? []).map((row) => [text(row.code), text(row.aed_per_unit)])))
      setPriceDrafts(Object.fromEntries((next.prices ?? []).map((row) => [text(row.id), text(row.price_label)])))
      setPlanDrafts(Object.fromEntries((next.plans ?? []).map((row) => [text(row.id), { name: text(row.name), minimum_amount: text(row.minimum_amount), profit_percent: text(row.profit_percent), commission_percent: text(row.commission_percent) }])))
      const paymentDetails = next.paymentDetails?.[0]
      if (paymentDetails) setPaymentDetailsDraft({ bank_name: text(paymentDetails.bank_name), account_name: text(paymentDetails.account_name), account_number: text(paymentDetails.account_number), iban: text(paymentDetails.iban), swift: text(paymentDetails.swift), note: text(paymentDetails.note), crypto: JSON.stringify(paymentDetails.crypto ?? [], null, 2) })
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load administration data.'))
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const client = requireSupabase()
    const { data: listener } = client.auth.onAuthStateChange(() => { void load() })
    return () => listener.subscription.unsubscribe()
  }, [load])

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    if (!query) return rows.users ?? []
    return (rows.users ?? []).filter((item) => [item.full_name, item.mobile, item.id].some((value) => text(value).toLowerCase().includes(query)))
  }, [rows.users, customerSearch])

  const customerActivity = useMemo(() => {
    if (!profileCustomerId) return []
    const sources: [string, Row[]][] = [
      ['Top-up', rows.topups ?? []], ['Withdrawal', rows.withdrawals ?? []],
      ['Profit payout', rows.profits ?? []], ['Investment', rows.investments ?? []],
      ['Payment', rows.payments ?? []], ['Reservation deposit', rows.reservationDeposits ?? []],
    ]
    return sources.flatMap(([type, items]) => items
      .filter((item) => item.user_id === profileCustomerId)
      .map((item) => ({
        id: type + '-' + text(item.id), type,
        amount: item.amount ?? item.amount_aed ?? item.total_amount ?? '—',
        status: item.status ?? '—',
        created_at: item.created_at ?? item.requested_at ?? item.submitted_at ?? item.date ?? null,
      })))
      .sort((a, b) => new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime())
  }, [profileCustomerId, rows])

  const stats = useMemo(() => ({
    properties: (rows.properties ?? []).length,
    enquiries: (rows.enquiries ?? []).filter((row) => row.status === 'new').length,
    customers: (rows.users ?? []).length,
    pending: (rows.topups ?? []).filter((row) => row.status === 'pending').length + (rows.withdrawals ?? []).filter((row) => row.status === 'pending').length,
  }), [rows])

  const financeSummary = useMemo(() => ({
    topups: (rows.topups ?? []).length,
    withdrawals: (rows.withdrawals ?? []).length,
    profitCredits: (rows.profits ?? []).length,
    pendingTopups: (rows.topups ?? []).filter((row) => row.status === 'pending').length,
    pendingWithdrawals: (rows.withdrawals ?? []).filter((row) => row.status === 'pending').length,
    approvedWithdrawals: (rows.withdrawals ?? []).filter((row) => row.status === 'approved').length,
  }), [rows])

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await work(); setNotice(success); await load() }
    catch (cause) { setError(errorMessage(cause, 'The action could not be completed.')) }
    finally { setBusy(false) }
  }

  const saveProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const client = requireSupabase()
      const payload = { ...propertyDraft, slug: propertyDraft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
      const query = editingPropertyId ? client.from('properties').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingPropertyId) : client.from('properties').insert(payload)
      const { error: saveError } = await query
      if (saveError) throw saveError
      setEditingPropertyId('')
      setPropertyDraft({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' })
    }, editingPropertyId ? 'Property changes saved.' : 'Property saved.')
  }

  const saveCustomerProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profileCustomerId) { setError('Select a customer first.'); return }
    const level = Number(profileLevel)
    if (!Number.isInteger(level) || level < 0) { setError('Membership level must be a whole number of zero or higher.'); return }
    await run(async () => {
      const { error: saveError } = await requireSupabase().from('member_profiles').upsert({
        user_id: profileCustomerId,
        address: profileAddress.trim() || null,
        interest: profileInterest.trim() || null,
        membership_level: level,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (saveError) throw saveError
    }, 'Customer profile saved.')
  }

  const sendCustomerNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const userId = notificationDraft.user_id.trim()
    const title = notificationDraft.title.trim()
    const body = notificationDraft.body.trim()
    if (!userId || !title || !body) { setError('Customer ID, title and message are required.'); return }
    if (title.length > 160 || body.length > 4000) { setError('Title must be 160 characters or less and message 4,000 characters or less.'); return }
    await run(async () => {
      const { error: insertError } = await requireSupabase().from('notifications').insert({ user_id: userId, title, body })
      if (insertError) throw insertError
      setNotificationDraft({ user_id: '', title: '', body: '' })
    }, 'Customer notification sent.')
  }

  const savePromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const query = editingPromotionId
        ? requireSupabase().from('promotions').update({ ...promotionDraft, updated_at: new Date().toISOString() }).eq('id', editingPromotionId)
        : requireSupabase().from('promotions').insert(promotionDraft)
      const { error: saveError } = await query
      if (saveError) throw saveError
      setEditingPromotionId('')
      setPromotionDraft({ title: '', description: '', image_url: '', active: false })
    }, editingPromotionId ? 'Promotion changes saved.' : 'Promotion created.')
  }

  const reviewTopup = (id: string, approve: boolean) => run(async () => {
    const { error: rpcError } = await requireSupabase().rpc('admin_review_topup', { p_request_id: id, p_approve: approve, p_admin_note: approve ? 'Approved by administrator' : 'Rejected by administrator' })
    if (rpcError) throw rpcError
  }, approve ? 'Top-up approved and ledger credited.' : 'Top-up rejected.')

  const reviewWithdrawal = (id: string, action: 'approve' | 'reject' | 'pay') => run(async () => {
    const note = action === 'pay' ? 'External payout confirmed by administrator' : action === 'approve' ? 'Approved by administrator; external payout still required' : 'Rejected by administrator'
    const { error: rpcError } = await requireSupabase().rpc('admin_review_withdrawal', { p_request_id: id, p_action: action, p_admin_note: note })
    if (rpcError) throw rpcError
  }, action === 'pay' ? 'Withdrawal marked paid in the internal ledger.' : action === 'approve' ? 'Withdrawal approved; no bank transfer was made.' : 'Withdrawal rejected.')

  const creditProfit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const { error: rpcError } = await requireSupabase().rpc('admin_credit_profit_payout', {
        p_user_id: profitDraft.user_id, p_amount: Number(profitDraft.amount), p_currency: profitDraft.currency,
        p_period_start: profitDraft.period_start, p_period_end: profitDraft.period_end, p_description: profitDraft.description,
      })
      if (rpcError) throw rpcError
      setProfitDraft({ user_id: '', amount: '', currency: 'AED', period_start: '', period_end: '', description: 'Monthly profit credited to customer wallet' })
    }, 'Profit credited to the customer internal wallet.')
  }

  const setAccountState = (customerId: string, status: 'active' | 'frozen' | 'blocked') => run(async () => {
    const { error: stateError } = await requireSupabase().from('account_states').upsert({ user_id: customerId, status, reason: status === 'active' ? null : 'Updated by administrator', updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (stateError) throw stateError
  }, `Customer account set to ${status}.`)

  const updateStatus = (table: string, id: string, patch: Row, success: string) => run(async () => {
    const { error: updateError } = await requireSupabase().from(table).update(patch).eq('id', id)
    if (updateError) throw updateError
  }, success)

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedThread || !reply.trim() || !user) return
    await run(async () => {
      const client = requireSupabase()
      const { error: sendError } = await client.from('support_messages').insert({ thread_id: selectedThread, sender_id: user.id, message: reply.trim() })
      if (sendError) throw sendError
      await client.from('support_threads').update({ updated_at: new Date().toISOString() }).eq('id', selectedThread)
      setReply('')
    }, 'Reply sent.')
  }

  const savePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const payload = { ...postDraft, slug: postDraft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), updated_by: user?.id }
      const { error: saveError } = await requireSupabase().from('posts').insert(payload)
      if (saveError) throw saveError
      setPostDraft({ title: '', slug: '', category: 'News', excerpt: '', content: '', cover_image_url: '', author_name: 'Msheireb Properties' })
    }, 'Journal post created as a draft.')
  }

  const savePaymentDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      let crypto: unknown
      try { crypto = JSON.parse(paymentDetailsDraft.crypto || '[]') } catch { throw new Error('Crypto payment instructions must be valid JSON.') }
      if (!Array.isArray(crypto)) throw new Error('Crypto payment instructions must be a JSON array.')
      const payload = { bank_name: paymentDetailsDraft.bank_name, account_name: paymentDetailsDraft.account_name, account_number: paymentDetailsDraft.account_number, iban: paymentDetailsDraft.iban, swift: paymentDetailsDraft.swift, note: paymentDetailsDraft.note, crypto, updated_by: user?.id, updated_at: new Date().toISOString() }
      const existing = rows.paymentDetails?.[0]
      const query = existing?.id ? requireSupabase().from('payment_details').update(payload).eq('id', existing.id) : requireSupabase().from('payment_details').insert(payload)
      const { error: saveError } = await query
      if (saveError) throw saveError
    }, 'Payment instructions saved.')
  }

  const signOut = async () => {
    await requireSupabase().auth.signOut()
    setUser(null); setAuthorized(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <header className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="eyebrow text-brass">Private workspace</p><h1 className="display mt-3 text-3xl sm:text-4xl">Administration</h1><p className="mt-2 text-sm text-ink-soft">Msheireb Properties · Secure Supabase workspace</p></div>
            <div className="flex gap-3"><Link to="/dashboard" className={softButton}>Customer view <ArrowRight /></Link>{user ? <button type="button" onClick={signOut} className={softButton}>Sign out</button> : null}</div>
          </header>

          {checking ? <div className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Checking administrator access…</div> : null}
          {!checking && !authorized ? <section className="max-w-2xl border border-border bg-card p-8 sm:p-12"><p className="eyebrow text-brass">Restricted access</p><h2 className="display mt-4 text-2xl">{user ? 'This account is not an administrator.' : 'Sign in to continue.'}</h2><p className="mt-3 text-sm leading-7 text-ink-soft">{user ? 'Ask the site owner to add this registered account to the admin_members table in Supabase. Admin access is never self-assigned.' : 'Use your administrator account to sign in first.'}</p><Link to="/login" className={buttonClass + ' mt-6'}>Go to login <ArrowRight /></Link></section> : null}
          {error ? <p role="alert" className="mb-5 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" className="mb-5 border border-brass/40 bg-brass/5 px-4 py-3 text-sm">{notice}</p> : null}

          {authorized ? <>
            <nav aria-label="Administration sections" className="mb-8 flex gap-2 overflow-x-auto border-b border-border pb-3">
              {SECTIONS.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={section === item.id ? 'eyebrow shrink-0 border-b-2 border-brass px-4 py-3 text-[0.55rem] text-brass' : 'eyebrow shrink-0 px-4 py-3 text-[0.55rem] text-ink-soft hover:text-foreground'}>{item.label}</button>)}
            </nav>

            {section === 'overview' ? <section>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Published properties', stats.properties],
                  ['New enquiries', stats.enquiries],
                  ['Customer accounts', stats.customers],
                  ['Pending financial requests', stats.pending],
                ].map(([label, value]) => <div key={label} className="border border-border bg-card p-6"><p className="eyebrow text-[0.5rem] text-ink-soft">{label}</p><p className="display mt-3 text-3xl">{value}</p></div>)}
              </div>
              <div className="mt-6 border border-border bg-card p-6"><h2 className="display text-xl">Quick actions</h2><div className="mt-4 flex flex-wrap gap-3">{SECTIONS.filter((item) => item.id !== 'overview').map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={softButton}>{item.label} <ArrowRight /></button>)}</div></div>
            </section> : null}

            {section === 'properties' ? <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_1.2fr]">
              <form onSubmit={saveProperty} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">{editingPropertyId ? 'Edit property' : 'Add property'}</h2><div className="mt-5 grid gap-3">
                <input className={inputClass} required placeholder="Property name" value={propertyDraft.name} onChange={(e) => setPropertyDraft({ ...propertyDraft, name: e.target.value, slug: propertyDraft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} />
                <input className={inputClass} required placeholder="URL slug" value={propertyDraft.slug} onChange={(e) => setPropertyDraft({ ...propertyDraft, slug: e.target.value })} />
                <input className={inputClass} placeholder="Location" value={propertyDraft.location} onChange={(e) => setPropertyDraft({ ...propertyDraft, location: e.target.value })} />
                <input className={inputClass} placeholder="Price label" value={propertyDraft.price_label} onChange={(e) => setPropertyDraft({ ...propertyDraft, price_label: e.target.value })} />
                <input className={inputClass} placeholder="Cover image URL" value={propertyDraft.cover_image_url} onChange={(e) => setPropertyDraft({ ...propertyDraft, cover_image_url: e.target.value })} />
                <textarea className={inputClass} rows={4} placeholder="Description" value={propertyDraft.description} onChange={(e) => setPropertyDraft({ ...propertyDraft, description: e.target.value })} />
                <select className={inputClass} value={propertyDraft.status} onChange={(e) => setPropertyDraft({ ...propertyDraft, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select>
                <div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>{editingPropertyId ? 'Save changes' : 'Save property'} <ArrowRight /></button>{editingPropertyId ? <button type="button" disabled={busy} className={softButton} onClick={() => { setEditingPropertyId(''); setPropertyDraft({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' }) }}>Cancel edit</button> : null}</div>
              </div></form>
              <div className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">Property catalogue</h2></div><div className="divide-y divide-border">{(rows.properties ?? []).map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{text(item.name)}</b><p className="mt-1 text-xs text-ink-soft">{text(item.location)} · {text(item.price_label)}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{text(item.slug)}</p></div><div className="flex flex-wrap gap-2"><span className="eyebrow self-center text-[0.48rem] text-brass">{text(item.status)}</span><button disabled={busy} className={softButton} onClick={() => { setEditingPropertyId(text(item.id)); setPropertyDraft({ name: text(item.name), slug: text(item.slug), location: text(item.location), description: text(item.description), price_label: text(item.price_label), cover_image_url: text(item.cover_image_url), status: text(item.status) }) }}>Edit</button>{item.status !== 'published' ? <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'published', updated_at: new Date().toISOString() }, 'Property published.')} className={softButton}>Publish</button> : <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'draft', updated_at: new Date().toISOString() }, 'Property moved to draft.')} className={softButton}>Unpublish</button>}</div></div>)}{!(rows.properties ?? []).length ? <p className="p-6 text-sm text-ink-soft">No properties yet.</p> : null}</div></div>
            </section> : null}

            {section === 'enquiries' ? <DataTable title="Customer enquiries" rows={rows.enquiries ?? []} columns={['full_name','mobile','email','message','status','created_at']} render={(item) => <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-soft">{text(item.status)}</span><button className={softButton} disabled={busy || item.status === 'contacted'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'contacted' }, 'Enquiry marked contacted.')}>Mark contacted</button><button className={softButton} disabled={busy || item.status === 'closed'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'closed' }, 'Enquiry closed.')}>Close</button></div>} /> : null}
            {section === 'users' ? <section className="grid gap-4"><form onSubmit={saveCustomerProfile} className="grid gap-3 border border-border bg-card p-5"><h3 className="display text-lg">Edit customer profile</h3><select required className={inputClass} value={profileCustomerId} onChange={(event) => { const id = event.target.value; setProfileCustomerId(id); const p = (rows.memberProfiles ?? []).find((item) => item.user_id === id); setProfileAddress(text(p?.address)); setProfileInterest(text(p?.interest)); setProfileLevel(text(p?.membership_level ?? 0)) }}><option value="">Select customer</option>{(rows.users ?? []).map((item) => <option key={item.id} value={item.id}>{text(item.full_name) || 'Customer'} · {text(item.mobile) || text(item.id)}</option>)}</select><div className="grid gap-3 sm:grid-cols-3"><input className={inputClass} placeholder="Address" value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} /><input className={inputClass} placeholder="Property interest" value={profileInterest} onChange={(event) => setProfileInterest(event.target.value)} /><input type="number" min="0" step="1" className={inputClass} placeholder="Membership level" value={profileLevel} onChange={(event) => setProfileLevel(event.target.value)} /></div><button disabled={busy || !profileCustomerId} className={buttonClass}>Save customer profile <ArrowRight /></button></form>{profileCustomerId ? <DataTable title="Selected customer activity" rows={customerActivity} columns={['type','amount','status','created_at']} /> : null}<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="display text-xl">Customer accounts</h2><p className="mt-1 text-xs text-ink-soft">Search by customer name, mobile number or account ID.</p></div><input className={`${inputClass} sm:max-w-sm`} value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customers" /></div><DataTable title="Registered customers" rows={filteredCustomers} columns={['full_name','mobile','preferred_currency','preferred_language','created_at']} render={(item) => { const state = (rows.accounts ?? []).find((entry) => entry.user_id === item.id)?.status ?? 'active'; return <div className="flex flex-wrap items-center gap-2"><span>{state}</span>{state !== 'active' ? <button disabled={busy} className={softButton} onClick={() => setAccountState(text(item.id), 'active')}>Activate</button> : <button disabled={busy} className={softButton} onClick={() => setAccountState(text(item.id), 'frozen')}>Freeze</button>}<button disabled={busy || state === 'blocked'} className={softButton} onClick={() => setAccountState(text(item.id), 'blocked')}>Block</button></div> }} /></section> : null}
            {section === 'promotions' ? <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_1.2fr]">
              <form onSubmit={savePromotion} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">{editingPromotionId ? 'Edit promotion' : 'Create promotion'}</h2><div className="mt-5 grid gap-3"><input required className={inputClass} placeholder="Promotion title" value={promotionDraft.title} onChange={(e) => setPromotionDraft({ ...promotionDraft, title: e.target.value })} /><textarea className={inputClass} rows={4} placeholder="Description" value={promotionDraft.description} onChange={(e) => setPromotionDraft({ ...promotionDraft, description: e.target.value })} /><input className={inputClass} placeholder="Image URL" value={promotionDraft.image_url} onChange={(e) => setPromotionDraft({ ...promotionDraft, image_url: e.target.value })} /><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={promotionDraft.active} onChange={(e) => setPromotionDraft({ ...promotionDraft, active: e.target.checked })} /> Active immediately</label><div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>{editingPromotionId ? 'Save changes' : 'Create promotion'} <ArrowRight /></button>{editingPromotionId ? <button type="button" disabled={busy} className={softButton} onClick={() => { setEditingPromotionId(''); setPromotionDraft({ title: '', description: '', image_url: '', active: false }) }}>Cancel edit</button> : null}</div></div></form>
              <DataTable title="Promotions" rows={rows.promotions ?? []} columns={['title','description','active','starts_at','ends_at']} render={(item) => <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => { setEditingPromotionId(text(item.id)); setPromotionDraft({ title: text(item.title), description: text(item.description), image_url: text(item.image_url), active: Boolean(item.active) }) }}>Edit</button><button disabled={busy} className={softButton} onClick={() => updateStatus('promotions', text(item.id), { active: !item.active, updated_at: new Date().toISOString() }, item.active ? 'Promotion paused.' : 'Promotion activated.')}>{item.active ? 'Pause' : 'Activate'}</button></div>} />
            </section> : null}

            {section === 'finance' ? <div className="grid gap-6">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
                ['Top-up requests', financeSummary.topups], ['Withdrawal requests', financeSummary.withdrawals], ['Profit credits', financeSummary.profitCredits],
                ['Pending top-ups', financeSummary.pendingTopups], ['Pending withdrawals', financeSummary.pendingWithdrawals], ['Approved withdrawals awaiting transfer', financeSummary.approvedWithdrawals],
              ].map(([label, value]) => <div key={String(label)} className="border border-border bg-card p-4"><p className="text-xs text-ink-soft">{label}</p><p className="display mt-2 text-2xl">{value}</p></div>)}</section>
              <DataTable title="Top-up requests" rows={rows.topups ?? []} columns={['user_id','amount','currency','payment_method','payment_reference','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), true)}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), false)}>Reject</button></div> : null} />
              <DataTable title="Withdrawal requests" rows={rows.withdrawals ?? []} columns={['user_id','amount','currency','payout_method','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'approve')}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'reject')}>Reject</button></div> : item.status === 'approved' ? <button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'pay')}>Mark paid after transfer</button> : null} />
              <form onSubmit={creditProfit} className="border border-border bg-card p-6"><h2 className="display text-xl">Credit profit to customer wallet</h2><p className="mt-2 text-xs leading-6 text-ink-soft">This posts an internal wallet credit and audit record. It does not send a bank transfer.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><input required className={inputClass} placeholder="Customer user UUID" value={profitDraft.user_id} onChange={(e) => setProfitDraft({ ...profitDraft, user_id: e.target.value })} /><input required type="number" min="0.01" step="0.01" className={inputClass} placeholder="Amount" value={profitDraft.amount} onChange={(e) => setProfitDraft({ ...profitDraft, amount: e.target.value })} /><select className={inputClass} value={profitDraft.currency} onChange={(e) => setProfitDraft({ ...profitDraft, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select><input required type="date" className={inputClass} value={profitDraft.period_start} onChange={(e) => setProfitDraft({ ...profitDraft, period_start: e.target.value })} /><input required type="date" className={inputClass} value={profitDraft.period_end} onChange={(e) => setProfitDraft({ ...profitDraft, period_end: e.target.value })} /><input className={inputClass} value={profitDraft.description} onChange={(e) => setProfitDraft({ ...profitDraft, description: e.target.value })} /></div><button disabled={busy} className={buttonClass + ' mt-4'}>Credit internal wallet <ArrowRight /></button></form>
              <DataTable title="Recent profit credits" rows={rows.profits ?? []} columns={['user_id','amount','currency','period_start','period_end','status','created_at']} />
              <DataTable title="Financial audit history" rows={rows.financialAudit ?? []} columns={['created_at','actor_id','action','entity_type','entity_id','details']} />
              <DataTable title="Investment requests" rows={rows.investments ?? []} columns={['user_id','property_id','amount','currency','status','created_at']} />
            </div> : null}

            {section === 'investments' ? <div className="grid gap-6"><DataTable title="Customer investment requests" rows={rows.investmentRequests ?? []} columns={['user_id','property_name','plan_code','amount','expected_profit','expected_commission','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => updateStatus('investment_requests', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id }, 'Investment request approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('investment_requests', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id }, 'Investment request rejected.')}>Reject</button></div> : null} /><DataTable title="Active investment ledger" rows={rows.investments ?? []} columns={['user_id','property_id','amount','currency','status','created_at']} /></div> : null}

            {section === 'verifications' ? <DataTable title="Customer identity verification" rows={rows.verifications ?? []} columns={['user_id','document_type','document_name','document_url','note','status','submitted_at']} render={(item) => item.status === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => updateStatus('verifications', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id }, 'Identity verification approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('verifications', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Please resubmit a valid document.' }, 'Identity verification rejected.')}>Reject</button></div> : null} /> : null}

            {section === 'crypto' ? <DataTable title="Crypto payment submissions" rows={rows.cryptoPayments ?? []} columns={['user_id','kind','amount','currency','coin','network','transaction_hash','proof_url','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => updateStatus('crypto_payments', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_note: 'Approved after manual verification' }, 'Crypto submission approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('crypto_payments', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, admin_note: 'Rejected after review' }, 'Crypto submission rejected.')}>Reject</button></div> : null} /> : null}

            {section === 'tasks' ? <div className="grid gap-6"><DataTable title="Customer tasks" rows={rows.tasks ?? []} columns={['user_id','title','detail','target_level','status','created_at']} render={(item) => item.status === 'submitted' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => updateStatus('member_tasks', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Approved' }, 'Task approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('member_tasks', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Please review and resubmit' }, 'Task returned for correction.')}>Return</button></div> : null} /><DataTable title="Membership plans and levels" rows={rows.plans ?? []} columns={['level','code','name','minimum_amount','profit_percent','commission_percent','active']} render={(item) => <button disabled={busy} className={softButton} onClick={() => updateStatus('membership_plans', text(item.id), { active: !item.active, updated_at: new Date().toISOString(), updated_by: user?.id }, item.active ? 'Membership plan disabled.' : 'Membership plan enabled.')}>{item.active ? 'Disable' : 'Enable'}</button>} /><DataTable title="Extended member profiles" rows={rows.memberProfiles ?? []} columns={['user_id','address','referral_code','interest','membership_level','created_at']} /></div> : null}

            {section === 'payments' ? <div className="grid gap-6"><form onSubmit={savePaymentDetails} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Payment instructions</h2><p className="text-xs text-ink-soft">These details are shown to signed-in customers as manual payment instructions. Never enter private API keys here.</p><div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} placeholder="Bank name" value={paymentDetailsDraft.bank_name} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, bank_name: e.target.value })} /><input className={inputClass} placeholder="Account name" value={paymentDetailsDraft.account_name} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, account_name: e.target.value })} /><input className={inputClass} placeholder="Account number" value={paymentDetailsDraft.account_number} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, account_number: e.target.value })} /><input className={inputClass} placeholder="IBAN" value={paymentDetailsDraft.iban} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, iban: e.target.value })} /><input className={inputClass} placeholder="SWIFT / BIC" value={paymentDetailsDraft.swift} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, swift: e.target.value })} /><input className={inputClass} placeholder="Payment note" value={paymentDetailsDraft.note} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, note: e.target.value })} /></div><label className="text-xs text-ink-soft">Crypto instructions (JSON array)</label><textarea rows={4} className={inputClass} value={paymentDetailsDraft.crypto} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, crypto: e.target.value })} /><button disabled={busy} className={buttonClass}>Save payment instructions <ArrowRight /></button></form><DataTable title="Payment intents (test-mode records only)" rows={rows.payments ?? []} columns={['user_id','kind','amount','amount_charged','currency','provider','mode','status','created_at']} /><DataTable title="Reservation deposits" rows={rows.reservationDeposits ?? []} columns={['user_id','property_name','amount','amount_charged','currency','mode','created_at']} /><DataTable title="Payment instructions" rows={rows.paymentDetails ?? []} columns={['bank_name','account_name','account_number','iban','swift','note','updated_at']} /><p className="border border-brass/40 bg-brass/5 p-4 text-xs leading-6">Payment intent and reservation records do not confirm that money was received. A verified payment-provider webhook is required before any live payment or wallet credit.</p></div> : null}

            {section === 'content' ? <div className="grid gap-6"><form onSubmit={savePost} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Create journal post</h2><div className="grid gap-3 sm:grid-cols-2"><input required className={inputClass} placeholder="Post title" value={postDraft.title} onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value, slug: postDraft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} /><input required className={inputClass} placeholder="URL slug" value={postDraft.slug} onChange={(e) => setPostDraft({ ...postDraft, slug: e.target.value })} /><input required className={inputClass} placeholder="Category" value={postDraft.category} onChange={(e) => setPostDraft({ ...postDraft, category: e.target.value })} /><input className={inputClass} placeholder="Cover image URL" value={postDraft.cover_image_url} onChange={(e) => setPostDraft({ ...postDraft, cover_image_url: e.target.value })} /><input required className={inputClass} placeholder="Author name" value={postDraft.author_name} onChange={(e) => setPostDraft({ ...postDraft, author_name: e.target.value })} /></div><textarea required rows={2} className={inputClass} placeholder="Short excerpt" value={postDraft.excerpt} onChange={(e) => setPostDraft({ ...postDraft, excerpt: e.target.value })} /><textarea required rows={8} className={inputClass} placeholder="Full article content" value={postDraft.content} onChange={(e) => setPostDraft({ ...postDraft, content: e.target.value })} /><button disabled={busy} className={buttonClass}>Save draft <ArrowRight /></button></form><DataTable title="Journal and website posts" rows={rows.posts ?? []} columns={['title','slug','category','excerpt','author_name','published','published_at','created_at']} render={(item) => <button disabled={busy} className={softButton} onClick={() => updateStatus('posts', text(item.id), { published: !item.published, published_at: item.published ? null : new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: user?.id }, item.published ? 'Post unpublished.' : 'Post published.')}>{item.published ? 'Unpublish' : 'Publish'}</button>} /></div> : null}

            {section === 'team' ? <div className="grid gap-6"><DataTable title="Administrator accounts" rows={rows.admins ?? []} columns={['user_id','role','created_at']} /><p className="border border-border bg-card p-5 text-sm leading-6 text-ink-soft">Administrator membership is managed securely in Supabase. This panel does not let an administrator grant themselves elevated access or remove the owner account.</p><form onSubmit={sendCustomerNotification} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Send customer notification</h2><p className="text-xs text-ink-soft">Enter the customer's account UUID from the Customers section. This sends an in-app notification to that customer only.</p><input required className={inputClass} placeholder="Customer account ID (UUID)" value={notificationDraft.user_id} onChange={(event) => setNotificationDraft({ ...notificationDraft, user_id: event.target.value })} /><input required maxLength={160} className={inputClass} placeholder="Notification title" value={notificationDraft.title} onChange={(event) => setNotificationDraft({ ...notificationDraft, title: event.target.value })} /><textarea required maxLength={4000} rows={4} className={inputClass} placeholder="Notification message" value={notificationDraft.body} onChange={(event) => setNotificationDraft({ ...notificationDraft, body: event.target.value })} /><button disabled={busy} className={buttonClass}>Send notification <ArrowRight /></button></form><DataTable title="Customer notifications" rows={rows.notifications ?? []} columns={['user_id','title','body','read_at','created_at']} /></div> : null}

            {section === 'support' ? <section className="grid gap-5 lg:grid-cols-[minmax(16rem,0.7fr)_1.3fr]"><div className="border border-border bg-card"><h2 className="display border-b border-border px-5 py-4 text-xl">Support conversations</h2><div className="divide-y divide-border">{(rows.threads ?? []).map((thread) => <button key={thread.id} onClick={() => setSelectedThread(text(thread.id))} className={selectedThread === thread.id ? 'block w-full bg-brass/10 px-5 py-4 text-left' : 'block w-full px-5 py-4 text-left hover:bg-brass/5'}><b className="block text-xs">{text(thread.user_id)}</b><span className="mt-1 block text-[0.65rem] text-ink-soft">{text(thread.status)} · {date(thread.updated_at)}</span></button>)}{!(rows.threads ?? []).length ? <p className="p-5 text-sm text-ink-soft">No support conversations.</p> : null}</div></div><SupportConversation threadId={selectedThread} onSend={sendReply} reply={reply} setReply={setReply} busy={busy} /></section> : null}

            {section === 'settings' ? <div className="grid gap-6">
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Currency exchange rates</h2><p className="mt-1 text-xs text-ink-soft">AED value of one unit of each currency. Enter rates supplied by your finance provider.</p></div>{(rows.fx ?? []).map((item) => <form key={item.code} onSubmit={(event) => { event.preventDefault(); void run(async () => { const value = Number(fxDrafts[text(item.code)]); if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a rate greater than zero.'); const { error: saveError } = await requireSupabase().from('fx_rates').update({ aed_per_unit: value, updated_at: new Date().toISOString(), updated_by: user?.id }).eq('code', item.code); if (saveError) throw saveError }, `Updated ${text(item.code)} exchange rate.`) }} className="grid items-center gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">{text(item.code)} · {text(item.label)}</label><input required type="number" min="0.00000001" step="0.00000001" className={inputClass} value={fxDrafts[text(item.code)] ?? ''} onChange={(event) => setFxDrafts({ ...fxDrafts, [text(item.code)]: event.target.value })} /><button disabled={busy} className={softButton}>Save rate</button></form>)}</section>
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Property price labels</h2><p className="mt-1 text-xs text-ink-soft">Update the public price text shown for each property slug.</p></div>{(rows.prices ?? []).map((item) => <form key={item.id} onSubmit={(event) => { event.preventDefault(); void run(async () => { const { error: saveError } = await requireSupabase().from('property_prices').update({ price_label: priceDrafts[text(item.id)], updated_at: new Date().toISOString(), updated_by: user?.id }).eq('id', item.id); if (saveError) throw saveError }, 'Property price label saved.') }} className="grid items-center gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">{text(item.slug)}</label><input required maxLength={120} className={inputClass} value={priceDrafts[text(item.id)] ?? ''} onChange={(event) => setPriceDrafts({ ...priceDrafts, [text(item.id)]: event.target.value })} /><button disabled={busy} className={softButton}>Save label</button></form>)}</section>
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Membership plan settings</h2><p className="mt-1 text-xs text-ink-soft">Changing percentages changes displayed plan terms. Do not advertise guaranteed returns unless legally approved and funded.</p></div>{(rows.plans ?? []).map((item) => { const draft = planDrafts[text(item.id)] ?? { name: text(item.name), minimum_amount: text(item.minimum_amount), profit_percent: text(item.profit_percent), commission_percent: text(item.commission_percent) }; return <form key={item.id} onSubmit={(event) => { event.preventDefault(); void run(async () => { const minimum = Number(draft.minimum_amount), profit = Number(draft.profit_percent), commission = Number(draft.commission_percent); if (![minimum, profit, commission].every(Number.isFinite) || minimum < 0 || profit < 0 || commission < 0 || profit > 100 || commission > 100) throw new Error('Enter valid non-negative amounts and percentages no greater than 100.'); const { error: saveError } = await requireSupabase().from('membership_plans').update({ name: draft.name.trim(), minimum_amount: minimum, profit_percent: profit, commission_percent: commission, updated_at: new Date().toISOString(), updated_by: user?.id }).eq('id', item.id); if (saveError) throw saveError }, 'Membership plan settings saved.') }} className="grid gap-2 border-t border-border pt-4"><p className="text-sm font-medium">Level {text(item.level)} · {text(item.code)}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><input required className={inputClass} aria-label="Plan name" value={draft.name} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, name: event.target.value } })} /><input required type="number" min="0" step="0.01" className={inputClass} aria-label="Minimum amount" placeholder="Minimum amount" value={draft.minimum_amount} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, minimum_amount: event.target.value } })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} aria-label="Profit percentage" placeholder="Profit %" value={draft.profit_percent} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, profit_percent: event.target.value } })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} aria-label="Commission percentage" placeholder="Commission %" value={draft.commission_percent} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, commission_percent: event.target.value } })} /></div><button disabled={busy} className={softButton + ' justify-self-start'}>Save plan settings</button></form> })}</section>
            </div> : null}

            <div className="mt-8 flex items-center justify-between border-t border-border pt-5"><p className="text-xs text-ink-soft">Signed in as {user?.email}</p><button type="button" disabled={busy} onClick={() => void load()} className={softButton}>Refresh data</button></div>
          </> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function DataTable({ title, rows, columns, render }: { title: string; rows: Row[]; columns: string[]; render?: (row: Row) => React.ReactNode }) {
  return <section className="overflow-hidden border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">{title}</h2><p className="mt-1 text-xs text-ink-soft">{rows.length} records</p></div><div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-xs"><thead className="bg-muted/40 text-ink-soft"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column.replaceAll('_', ' ')}</th>)}{render ? <th className="px-4 py-3">Action</th> : null}</tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={text(row.id)}>{columns.map((column) => <td key={column} className="max-w-64 px-4 py-3 align-top"><span className="block break-all">{column.endsWith('_at') ? date(row[column]) : text(row[column])}</span></td>)}{render ? <td className="px-4 py-3">{render(row)}</td> : null}</tr>)}</tbody></table>{!rows.length ? <p className="px-5 py-8 text-sm text-ink-soft">No records to display.</p> : null}</div></section>
}

function SupportConversation({ threadId, onSend, reply, setReply, busy }: { threadId: string; onSend: (event: FormEvent<HTMLFormElement>) => void; reply: string; setReply: (value: string) => void; busy: boolean }) {
  const [messages, setMessages] = useState<Row[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    if (!threadId) { setMessages([]); return }
    void requireSupabase().from('support_messages').select('*').eq('thread_id', threadId).order('created_at').then(({ data, error }) => {
      if (!active) return
      if (error) setLoadError(error.message)
      else { setLoadError(''); setMessages((data ?? []) as Row[]) }
    })
    return () => { active = false }
  }, [threadId])
  return <div className="flex min-h-80 flex-col border border-border bg-card"><h2 className="display border-b border-border px-5 py-4 text-xl">Conversation</h2>{!threadId ? <p className="m-auto p-6 text-sm text-ink-soft">Select a support conversation.</p> : <><div className="flex-1 space-y-3 p-5">{loadError ? <p role="alert" className="text-xs text-destructive">{loadError}</p> : null}{messages.map((message) => <article key={message.id} className="border border-border p-3"><p className="text-xs leading-6">{text(message.message)}</p><p className="mt-2 text-[0.6rem] text-ink-soft">{text(message.sender_id)} · {date(message.created_at)}</p></article>)}</div><form onSubmit={onSend} className="grid gap-3 border-t border-border p-5"><textarea required rows={3} className={inputClass} placeholder="Write a reply…" value={reply} onChange={(event) => setReply(event.target.value)} /><button disabled={busy || !reply.trim()} className={buttonClass}>Send reply <ArrowRight /></button></form></>}</div>
}
