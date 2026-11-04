import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { errorMessage } from '../lib/errors'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

type Row = Record<string, any>
type Section = 'overview' | 'properties' | 'enquiries' | 'users' | 'promotions' | 'finance' | 'support' | 'settings'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'users', label: 'Customers' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'finance', label: 'Wallet & finance' },
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
  const [promotionDraft, setPromotionDraft] = useState({ title: '', description: '', image_url: '', active: false })
  const [profitDraft, setProfitDraft] = useState({ user_id: '', amount: '', currency: 'AED', period_start: '', period_end: '', description: 'Monthly profit credited to customer wallet' })
  const [selectedThread, setSelectedThread] = useState('')
  const [reply, setReply] = useState('')

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
      }
      const names = Object.keys(queries)
      const results = await Promise.all(names.map((name) => queries[name]))
      const next: Record<string, Row[]> = {}
      results.forEach((result, index) => {
        if (result.error) throw result.error
        next[names[index]] = (result.data ?? []) as Row[]
      })
      setRows(next)
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

  const stats = useMemo(() => ({
    properties: (rows.properties ?? []).length,
    enquiries: (rows.enquiries ?? []).filter((row) => row.status === 'new').length,
    customers: (rows.users ?? []).length,
    pending: (rows.topups ?? []).filter((row) => row.status === 'pending').length + (rows.withdrawals ?? []).filter((row) => row.status === 'pending').length,
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
      const { error: saveError } = await client.from('properties').insert({
        ...propertyDraft,
        slug: propertyDraft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      })
      if (saveError) throw saveError
      setPropertyDraft({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' })
    }, 'Property saved.')
  }

  const savePromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const { error: saveError } = await requireSupabase().from('promotions').insert(promotionDraft)
      if (saveError) throw saveError
      setPromotionDraft({ title: '', description: '', image_url: '', active: false })
    }, 'Promotion created.')
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
              <form onSubmit={saveProperty} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">Add property</h2><div className="mt-5 grid gap-3">
                <input className={inputClass} required placeholder="Property name" value={propertyDraft.name} onChange={(e) => setPropertyDraft({ ...propertyDraft, name: e.target.value, slug: propertyDraft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} />
                <input className={inputClass} required placeholder="URL slug" value={propertyDraft.slug} onChange={(e) => setPropertyDraft({ ...propertyDraft, slug: e.target.value })} />
                <input className={inputClass} placeholder="Location" value={propertyDraft.location} onChange={(e) => setPropertyDraft({ ...propertyDraft, location: e.target.value })} />
                <input className={inputClass} placeholder="Price label" value={propertyDraft.price_label} onChange={(e) => setPropertyDraft({ ...propertyDraft, price_label: e.target.value })} />
                <input className={inputClass} placeholder="Cover image URL" value={propertyDraft.cover_image_url} onChange={(e) => setPropertyDraft({ ...propertyDraft, cover_image_url: e.target.value })} />
                <textarea className={inputClass} rows={4} placeholder="Description" value={propertyDraft.description} onChange={(e) => setPropertyDraft({ ...propertyDraft, description: e.target.value })} />
                <select className={inputClass} value={propertyDraft.status} onChange={(e) => setPropertyDraft({ ...propertyDraft, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select>
                <button disabled={busy} className={buttonClass}>Save property <ArrowRight /></button>
              </div></form>
              <div className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">Property catalogue</h2></div><div className="divide-y divide-border">{(rows.properties ?? []).map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{text(item.name)}</b><p className="mt-1 text-xs text-ink-soft">{text(item.location)} · {text(item.price_label)}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{text(item.slug)}</p></div><div className="flex flex-wrap gap-2"><span className="eyebrow self-center text-[0.48rem] text-brass">{text(item.status)}</span>{item.status !== 'published' ? <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'published', updated_at: new Date().toISOString() }, 'Property published.')} className={softButton}>Publish</button> : <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'draft', updated_at: new Date().toISOString() }, 'Property moved to draft.')} className={softButton}>Unpublish</button>}</div></div>)}{!(rows.properties ?? []).length ? <p className="p-6 text-sm text-ink-soft">No properties yet.</p> : null}</div></div>
            </section> : null}

            {section === 'enquiries' ? <DataTable title="Customer enquiries" rows={rows.enquiries ?? []} columns={['full_name','mobile','email','status','created_at']} render={(item) => <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-soft">{text(item.status)}</span><button className={softButton} disabled={busy || item.status === 'contacted'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'contacted' }, 'Enquiry marked contacted.')}>Mark contacted</button><button className={softButton} disabled={busy || item.status === 'closed'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'closed' }, 'Enquiry closed.')}>Close</button></div>} />} : null}
            {section === 'users' ? <DataTable title="Registered customers" rows={rows.users ?? []} columns={['full_name','mobile','preferred_currency','preferred_language','created_at']} /> : null}
            {section === 'promotions' ? <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_1.2fr]">
              <form onSubmit={savePromotion} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">Create promotion</h2><div className="mt-5 grid gap-3"><input required className={inputClass} placeholder="Promotion title" value={promotionDraft.title} onChange={(e) => setPromotionDraft({ ...promotionDraft, title: e.target.value })} /><textarea className={inputClass} rows={4} placeholder="Description" value={promotionDraft.description} onChange={(e) => setPromotionDraft({ ...promotionDraft, description: e.target.value })} /><input className={inputClass} placeholder="Image URL" value={promotionDraft.image_url} onChange={(e) => setPromotionDraft({ ...promotionDraft, image_url: e.target.value })} /><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={promotionDraft.active} onChange={(e) => setPromotionDraft({ ...promotionDraft, active: e.target.checked })} /> Active immediately</label><button disabled={busy} className={buttonClass}>Create promotion <ArrowRight /></button></div></form>
              <DataTable title="Promotions" rows={rows.promotions ?? []} columns={['title','description','active','starts_at','ends_at']} render={(item) => <button disabled={busy} className={softButton} onClick={() => updateStatus('promotions', text(item.id), { active: !item.active, updated_at: new Date().toISOString() }, item.active ? 'Promotion paused.' : 'Promotion activated.')}>{item.active ? 'Pause' : 'Activate'}</button>} />
            </section> : null}

            {section === 'finance' ? <div className="grid gap-6">
              <DataTable title="Top-up requests" rows={rows.topups ?? []} columns={['user_id','amount','currency','payment_method','payment_reference','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), true)}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), false)}>Reject</button></div> : null} />
              <DataTable title="Withdrawal requests" rows={rows.withdrawals ?? []} columns={['user_id','amount','currency','payout_method','status','created_at']} render={(item) => item.status === 'pending' ? <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'approve')}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'reject')}>Reject</button></div> : item.status === 'approved' ? <button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'pay')}>Mark paid after transfer</button> : null} />
              <form onSubmit={creditProfit} className="border border-border bg-card p-6"><h2 className="display text-xl">Credit profit to customer wallet</h2><p className="mt-2 text-xs leading-6 text-ink-soft">This posts an internal wallet credit and audit record. It does not send a bank transfer.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><input required className={inputClass} placeholder="Customer user UUID" value={profitDraft.user_id} onChange={(e) => setProfitDraft({ ...profitDraft, user_id: e.target.value })} /><input required type="number" min="0.01" step="0.01" className={inputClass} placeholder="Amount" value={profitDraft.amount} onChange={(e) => setProfitDraft({ ...profitDraft, amount: e.target.value })} /><select className={inputClass} value={profitDraft.currency} onChange={(e) => setProfitDraft({ ...profitDraft, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select><input required type="date" className={inputClass} value={profitDraft.period_start} onChange={(e) => setProfitDraft({ ...profitDraft, period_start: e.target.value })} /><input required type="date" className={inputClass} value={profitDraft.period_end} onChange={(e) => setProfitDraft({ ...profitDraft, period_end: e.target.value })} /><input className={inputClass} value={profitDraft.description} onChange={(e) => setProfitDraft({ ...profitDraft, description: e.target.value })} /></div><button disabled={busy} className={buttonClass + ' mt-4'}>Credit internal wallet <ArrowRight /></button></form>
              <DataTable title="Recent profit credits" rows={rows.profits ?? []} columns={['user_id','amount','currency','period_start','period_end','status','created_at']} />
              <DataTable title="Investment requests" rows={rows.investments ?? []} columns={['user_id','property_id','amount','currency','status','created_at']} />
            </div> : null}

            {section === 'support' ? <section className="grid gap-5 lg:grid-cols-[minmax(16rem,0.7fr)_1.3fr]"><div className="border border-border bg-card"><h2 className="display border-b border-border px-5 py-4 text-xl">Support conversations</h2><div className="divide-y divide-border">{(rows.threads ?? []).map((thread) => <button key={thread.id} onClick={() => setSelectedThread(text(thread.id))} className={selectedThread === thread.id ? 'block w-full bg-brass/10 px-5 py-4 text-left' : 'block w-full px-5 py-4 text-left hover:bg-brass/5'}><b className="block text-xs">{text(thread.user_id)}</b><span className="mt-1 block text-[0.65rem] text-ink-soft">{text(thread.status)} · {date(thread.updated_at)}</span></button>)}{!(rows.threads ?? []).length ? <p className="p-5 text-sm text-ink-soft">No support conversations.</p> : null}</div></div><SupportConversation threadId={selectedThread} onSend={sendReply} reply={reply} setReply={setReply} busy={busy} /></section> : null}

            {section === 'settings' ? <div className="grid gap-6"><DataTable title="Currency exchange rates" rows={rows.fx ?? []} columns={['code','label','aed_per_unit','updated_at']} /><DataTable title="Property price labels" rows={rows.prices ?? []} columns={['slug','price_label','updated_at']} /><DataTable title="Membership plans" rows={rows.plans ?? []} columns={['level','name','minimum_amount','profit_percent','commission_percent','active']} /></div> : null}

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
