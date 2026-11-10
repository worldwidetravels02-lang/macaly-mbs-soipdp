import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'
import { IMAGES } from '../data/site'

const meta = siteMetadata['/dashboard']
const currencies = ['OMR', 'AED', 'SAR', 'KWD', 'BHD', 'QAR'] as const
const normalizeInvestmentStatus = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
type Currency = (typeof currencies)[number]
type Investment = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; reference: string | null; property_id: string | null }
type InvestmentRequest = { id: string; property_name: string; plan_code: string | null; amount: number | string; currency: Currency; profit_percent: number | string | null; expected_profit: number | string | null; commission_percent: number | string | null; expected_commission: number | string | null; status: string; created_at: string }
type LedgerItem = { id: string; amount: number | string; currency: Currency; transaction_type: string; direction: string; status: string; description: string | null; created_at: string }
type Commission = { id: string; amount: number | string; currency: Currency; commission_type: string; status: string; description: string | null; created_at: string }
type MemberTask = { id: string; title: string; detail: string | null; target_level: number | null; status: string; created_at: string; reviewed_at?: string | null; review_note?: string | null }
type MembershipPlan = { id: string; level: number; name: string; minimum_amount: number | string; profit_percent: number | string; commission_percent: number | string; active: boolean }
type CustomerLevelAccess = { user_id: string; level_name: string; is_unlocked: boolean }

function formatMoney(amount: number | string, currency: Currency) {
  const numeric = Number(amount)
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0)
}
function formatDate(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(timestamp)
    : 'Date unavailable'
}

export const Route = createFileRoute('/dashboard')({
  head: () => {
    const canonical = canonicalUrl('/dashboard')
    return {
      meta: [{ title: meta.title }, { name: 'description', content: meta.description }, { name: 'robots', content: 'noindex' }],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [name, setName] = useState('Member')
  const [currency, setCurrency] = useState<Currency>('AED')
  const [balance, setBalance] = useState(0)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [investmentRequests, setInvestmentRequests] = useState<InvestmentRequest[]>([])
  const [activity, setActivity] = useState<LedgerItem[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [unread, setUnread] = useState(0)
  const [membershipLevel, setMembershipLevel] = useState(0)
  const [memberTasks, setMemberTasks] = useState<MemberTask[]>([])
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([])
  const [levelAccess, setLevelAccess] = useState<CustomerLevelAccess[]>([])
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getSession()
      if (authError) throw authError
      const current = auth.session?.user ?? null
      setUser(current)
      if (!current) return
      const [profile, wallet, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows, accessRows] = await Promise.all([
        client.from('profiles').select('full_name,preferred_currency').eq('id', current.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', current.id).eq('currency', currency).maybeSingle(),
        client.from('investments').select('id,amount,currency,status,created_at,reference,property_id').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('investment_requests').select('id,property_name,plan_code,amount,currency,profit_percent,expected_profit,commission_percent,expected_commission,status,created_at').eq('user_id', current.id).order('created_at', { ascending: false }),
        client.from('wallet_transactions').select('id,amount,currency,transaction_type,direction,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', current.id).is('read_at', null),
        client.from('commission_records').select('id,amount,currency,commission_type,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }),
        client.from('member_profiles').select('membership_level').eq('user_id', current.id).maybeSingle(),
        client.from('member_tasks').select('*').eq('user_id', current.id).order('created_at', { ascending: false }).limit(100),
        client.from('membership_plans').select('*').eq('active', true).order('level', { ascending: true }),
        client.from('customer_project_level_access').select('user_id,level_name,is_unlocked').eq('user_id', current.id),
      ])
      for (const result of [profile, wallet, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows, accessRows]) if (result.error) throw result.error
      setName(profile.data?.full_name?.trim() || current.user_metadata?.full_name || current.email?.split('@')[0] || 'Member')
      const preferred = profile.data?.preferred_currency
      if (preferred && currencies.includes(preferred as Currency) && preferred !== currency) {
        setCurrency(preferred as Currency)
        return
      }
      setBalance(Number(wallet.data?.balance ?? 0))
      setInvestments((projects.data ?? []) as Investment[])
      setInvestmentRequests((requests.data ?? []) as InvestmentRequest[])
      setActivity((ledger.data ?? []) as LedgerItem[])
      setCommissions((commissionRows.data ?? []) as Commission[])
      setMembershipLevel(Number(memberProfile.data?.membership_level ?? 0))
      setMemberTasks((taskRows.data ?? []) as MemberTask[])
      setMembershipPlans((planRows.data ?? []) as MembershipPlan[])
      setLevelAccess((accessRows.data ?? []) as CustomerLevelAccess[])
      setUnread(notices.count ?? 0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [currency])

  useEffect(() => {
    let active = true
    const client = requireSupabase()
    const run = async () => { if (active) await load() }
    void run()
    const { data: listener } = client.auth.onAuthStateChange(() => { void run() })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [load])

  const submitTaskForReview = async (task: MemberTask) => {
    const currentStatus = normalizeInvestmentStatus(task.status)
    if (!user?.id || !task.id || !['assigned', 'rejected'].includes(currentStatus)) {
      setTaskMessage('This task is not currently available for submission.')
      return
    }
    setTaskBusy(task.id)
    setTaskMessage('')
    try {
      const { data: updatedRows, error: updateError } = await requireSupabase().from('member_tasks')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', task.id).eq('user_id', user.id).in('status', ['assigned', 'rejected', 'returned'])
        .select('id')
      if (updateError) throw updateError
      if (!updatedRows?.length) throw new Error('This task has already changed. Refresh the dashboard and check its latest status.')
      setMemberTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'submitted' } : item))
      setTaskMessage('Task submitted to the administration team for review.')
    } catch (cause) {
      setTaskMessage(cause instanceof Error ? cause.message : 'Could not submit this task.')
    } finally {
      setTaskBusy(null)
    }
  }

  const activeProjects = investments.filter((row) => ['approved', 'funded', 'active', 'completed'].includes(normalizeInvestmentStatus(row.status))).length
  const pendingProjects = investmentRequests.filter((row) => ['pending', 'approved'].includes(normalizeInvestmentStatus(row.status))).length
  const fundedTotal = investments.filter((row) => ['funded', 'active', 'approved', 'completed'].includes(normalizeInvestmentStatus(row.status)) && row.currency === currency).reduce((total, row) => total + (Number(row.amount) || 0), 0)
  const investmentStatus = (value: string) => {
    const status = normalizeInvestmentStatus(value)
    if (status === 'pending') return { label: 'Awaiting review', detail: 'Your application is waiting for the administration team to review it.', tone: 'text-ink-soft' }
    if (status === 'approved') return { label: 'Approved', detail: 'Approved by the administration team. Check the funding record and wallet history for the posted transaction.', tone: 'text-brass' }
    if (status === 'funded' || status === 'active') return { label: 'Funded / active', detail: 'Funding has been recorded in the platform. Review your wallet history for the related ledger entry.', tone: 'text-emerald-700' }
    if (status === 'completed') return { label: 'Completed', detail: 'This investment record is marked completed.', tone: 'text-emerald-700' }
    if (status === 'rejected') return { label: 'Not approved', detail: 'This application was not approved. Contact customer support if you need clarification.', tone: 'text-red-700' }
    return { label: value.replace(/_/g, ' '), detail: 'The administration team may update this status as the request is processed.', tone: 'text-ink-soft' }
  }

  const commissionTotals = commissions.reduce<Record<string, { total: number; pending: number; approved: number; credited: number; rejected: number; count: number; pendingCount: number; approvedCount: number; creditedCount: number; rejectedCount: number }>>((totals, row) => {
    const key = row.currency
    const current = totals[key] ?? { total: 0, pending: 0, approved: 0, credited: 0, rejected: 0, count: 0, pendingCount: 0, approvedCount: 0, creditedCount: 0, rejectedCount: 0 }
    const amount = Number(row.amount) || 0
    const status = normalizeInvestmentStatus(row.status)
    current.total += amount
    current.count += 1
    if (status === 'pending') { current.pending += amount; current.pendingCount += 1 }
    else if (status === 'approved') { current.approved += amount; current.approvedCount += 1 }
    else if (['credited', 'paid', 'completed'].includes(status)) { current.credited += amount; current.creditedCount += 1 }
    else if (status === 'rejected') { current.rejected += amount; current.rejectedCount += 1 }
    totals[key] = current
    return totals
  }, {})
  const commissionCurrencyRows = Object.entries(commissionTotals).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSidebar mode="member" />

      <header className="fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#e8e4dc] bg-white/95 px-5 pl-20 backdrop-blur lg:left-64 lg:px-7">
        <div className="text-xs text-[#7b7b7b]"><span>Workspace</span><span className="mx-2">/</span><strong className="text-[#172238]">Dashboard</strong></div>
        <div className="flex items-center gap-3 sm:gap-5">
          <label className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[#888]">CURRENCY
            <select aria-label="Dashboard currency" value={currency} onChange={(event) => setCurrency(event.target.value as Currency)} className="rounded-md border border-[#e6e1d8] bg-white px-3 py-2 text-xs font-semibold text-[#172238]">{currencies.map((code) => <option key={code} value={code}>{code}</option>)}</select>
          </label>
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-[#e8e4dc] bg-[#fbfaf8] px-2 py-1.5 text-xs text-[#172238]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2e9e7] font-semibold">{name.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{name.split(' ')[0]}</strong><span className="text-[10px] text-[#888]">User</span></span></Link>
        </div>
      </header>

      <main id="main" className="pb-20 pt-24 lg:ml-64">
        <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 sm:px-7">
          <section className="relative overflow-hidden rounded-xl border border-[#e2e8e2] bg-gradient-to-r from-[#e8f2ec] via-[#eef5f1] to-[#f1f1eb] px-7 py-7 sm:px-9 sm:py-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-64 w-64 rounded-full bg-white/40" />
            <div className="relative">
              <h1 className="display text-3xl leading-tight text-[#211f1c] sm:text-4xl">Good afternoon, {name.split(' ')[0]}.</h1>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/residences" className="inline-flex items-center gap-2 rounded-md bg-[#201f1d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#3a3732]">Explore projects <ArrowRight /></Link>
                <Link to="/account" className="inline-flex items-center rounded-md border border-[#e1ded7] bg-white px-5 py-3 text-sm font-semibold text-[#282622] transition hover:border-[#b99a59]">View account</Link>
              </div>
            </div>
          </section>

          {loading ? <div data-testid="dashboard-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Opening your dashboard…</div> : null}
          {!loading && !user ? <section data-testid="dashboard-signed-out" className="border border-border bg-card p-8 sm:p-12"><p className="eyebrow text-brass">Member area</p><h2 className="display mt-4 text-2xl">Sign in to open your dashboard.</h2><p className="mt-3 text-sm text-ink-soft">Your dashboard holds your wallet, property requests, account details and customer support.</p><Link to="/login" className="eyebrow mt-6 inline-flex items-center gap-3 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link></section> : null}
          {error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {user && !loading ? <>
            <section id="tasks-achievements" className="grid gap-6">
              <section aria-label="Project groups" className="border border-border bg-card p-5 sm:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div><p className="eyebrow text-[0.5rem] text-brass">Explore Dubai</p><h2 className="display mt-2 text-xl">Project groups</h2></div>
                  <div className="flex gap-2">
                    <button type="button" aria-label="Previous project group" onClick={() => document.getElementById('member-level-track')?.scrollBy({ left: -320, behavior: 'smooth' })} className="grid h-10 w-10 place-items-center border border-border text-lg hover:border-brass">‹</button>
                    <button type="button" aria-label="Next project group" onClick={() => document.getElementById('member-level-track')?.scrollBy({ left: 320, behavior: 'smooth' })} className="grid h-10 w-10 place-items-center border border-border text-lg hover:border-brass">›</button>
                  </div>
                </div>
                <div id="member-level-track" className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-3">
                  {membershipPlans.map((plan, index) => {
                    const isJuniorTrial = plan.name.toLowerCase().includes('junior trial')
                    const unlocked = levelAccess.find((item) => item.user_id === user?.id && item.level_name === plan.name)?.is_unlocked ?? isJuniorTrial
                    const levelTasks = memberTasks.filter((task) => Number(task.target_level ?? 0) === Number(plan.level))
                    const approved = levelTasks.filter((task) => task.status === 'approved').length
                    const image = [IMAGES.marinaNight, IMAGES.tower, IMAGES.villas, IMAGES.penthouse][index % 4]
                    const card = <article className={['relative flex min-h-[245px] w-[260px] shrink-0 snap-start flex-col justify-end overflow-hidden border text-left sm:w-[300px]', unlocked ? 'border-brass/50' : 'border-border opacity-70'].join(' ')}>
                      <img src={image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#071426] via-[#071426]/65 to-transparent" />
                      <div className="relative p-5 text-white">
                        <div className="mb-3 flex items-center justify-between gap-2"><span className="eyebrow text-[0.5rem] text-[#d3b36c]">Project group {plan.level}</span><span className="bg-[#071426]/70 px-2 py-1 text-[0.58rem]">{unlocked ? 'Available' : '🔒 Locked'}</span></div>
                        <h3 className="display text-2xl">{plan.name}</h3>
                        <p className="mt-2 text-xs text-white/75">{approved} of {levelTasks.length} assigned tasks approved</p>
                        <p className="mt-4 text-xs font-semibold text-[#d3b36c]">{unlocked ? 'View properties →' : 'Access not yet assigned'}</p>
                      </div>
                    </article>
                    return unlocked ? <Link key={plan.id} to="/residences" search={{ level: plan.name }} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass">{card}</Link> : <div key={plan.id}>{card}</div>
                  })}
                  {membershipPlans.length === 0 ? <p className="border border-border p-5 text-sm text-ink-soft">Project groups will appear here when the administration team activates membership plans.</p> : null}
                </div>
                <div className="mt-3 flex justify-center gap-2">
                  {membershipPlans.map((plan, index) => <button key={plan.id} type="button" aria-label={`Show project group ${index + 1}`} onClick={() => document.getElementById('member-level-track')?.children[index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' })} className="h-1.5 w-5 bg-brass/40 transition hover:bg-brass" />)}
                </div>
              </section>
              <div className="border border-border bg-card">
                <div className="border-b border-border px-6 py-5"><h2 className="display text-xl">Your assigned tasks</h2><p className="mt-1 text-xs text-ink-soft">Submit completed tasks for administrator review. Returned tasks can be submitted again.</p></div>
                {memberTasks.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No tasks have been assigned to your account yet.</p> : <ul className="divide-y divide-border">{memberTasks.map((task) => {
                  const returned = ['rejected', 'returned'].includes(task.status)
                  const canSubmit = ['assigned', 'rejected', 'returned'].includes(task.status)
                  return <li key={task.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{task.title}</h3><span className="eyebrow text-[0.48rem] text-brass">{task.status.replace(/_/g, ' ')}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{task.detail || 'No additional task details.'}</p><p className="mt-2 text-xs text-ink-soft">Target level: {task.target_level ?? '—'} · Assigned {formatDate(task.created_at)}</p>{task.review_note ? <p className="mt-2 text-xs text-ink-soft">Admin note: {task.review_note}</p> : null}{returned ? <p className="mt-2 text-xs text-brass">This task was returned. Review the note and resubmit when complete.</p> : null}</div>
                    {canSubmit ? <button type="button" disabled={taskBusy === task.id} onClick={() => void submitTaskForReview(task)} className="eyebrow shrink-0 border border-brass/50 px-4 py-3 text-[0.52rem] disabled:opacity-50">{taskBusy === task.id ? 'Submitting…' : returned ? 'Resubmit task' : 'Submit for review'}</button> : null}
                  </li>
                })}</ul>}
              </div>
            </section>

            <section id="commissions" className="border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5"><h2 className="display text-xl">Your commissions</h2><Link to="/wallet" className="eyebrow text-[0.5rem]">Open wallet <ArrowRight /></Link></div>
              {commissionCurrencyRows.length > 0 ? <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2">{commissionCurrencyRows.map(([code, totals]) => <div key={code} className="border border-border/70 p-4"><div className="flex items-center justify-between gap-3"><p className="eyebrow text-[0.5rem] text-brass">Commission summary · {code}</p><span className="text-[0.65rem] text-ink-soft">{totals.count} records</span></div><p className="display mt-2 text-xl">{formatMoney(totals.total, code as Currency)}</p><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><p className="text-ink-soft">Pending review · {totals.pendingCount}</p><p className="mt-1">{formatMoney(totals.pending, code as Currency)}</p></div><div><p className="text-ink-soft">Approved, not yet credited · {totals.approvedCount}</p><p className="mt-1">{formatMoney(totals.approved, code as Currency)}</p></div><div><p className="text-ink-soft">Credited to wallet · {totals.creditedCount}</p><p className="mt-1 text-emerald-700">{formatMoney(totals.credited, code as Currency)}</p></div><div><p className="text-ink-soft">Rejected · {totals.rejectedCount}</p><p className="mt-1 text-red-700">{formatMoney(totals.rejected, code as Currency)}</p></div></div></div>)}</div> : null}
              {commissions.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No commission records yet. Approved commissions will appear here.</p> : <><p className="px-6 py-3 text-xs text-ink-soft">Amounts are grouped by currency. Pending and approved commissions are not available in your wallet until credited.</p><ul className="divide-y divide-border">{commissions.map((row) => {
                const status = normalizeInvestmentStatus(row.status)
                const completed = ['credited', 'paid', 'completed'].includes(status)
                const rejected = status === 'rejected'
                const approved = status === 'approved'
                const statusLabel = status === 'pending' ? 'Pending admin approval' : completed ? 'Credited to wallet' : rejected ? 'Rejected' : approved ? 'Approved' : row.status.replace(/_/g, ' ')
                const statusClass = completed ? 'text-emerald-700' : rejected ? 'text-red-700' : approved ? 'text-brass' : 'text-ink-soft'
                const statusDetail = status === 'pending' ? 'This commission is waiting for administrator review.' : completed ? 'This commission has been credited. Check your wallet transactions for the entry.' : rejected ? 'This commission was rejected and has not been credited.' : approved ? 'This commission is approved. Check your wallet balance and transaction history for the credit.' : 'The commission status will update when it is reviewed.'
                return <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4"><div><p className="text-sm capitalize">{row.commission_type.replace(/_/g, ' ')} commission</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)}{row.description ? ` · ${row.description}` : ''}</p><p className={`eyebrow mt-2 text-[0.55rem] ${statusClass}`}>{statusLabel}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{statusDetail}</p></div><p className="display text-base">{formatMoney(row.amount, row.currency)}</p></li>
              })}</ul></>}
            </section>
            <section id="investments" className="border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5"><h2 className="display text-xl">Investment applications</h2><Link to="/residences" className="eyebrow text-[0.5rem]">Explore properties <ArrowRight /></Link></div>
              {investmentRequests.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No investment applications have been submitted yet. Explore properties to find an opportunity and submit an application.</p> : <>
                <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2 lg:grid-cols-4"><div className="border border-border/70 p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Total applications</p><p className="display mt-2 text-2xl">{investmentRequests.length}</p></div><div className="border border-border/70 p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Awaiting review</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'pending').length}</p></div><div className="border border-border/70 p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Approved · awaiting funding</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'approved').length}</p></div><div className="border border-border/70 p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Funded / active / completed</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => ['funded', 'active', 'completed'].includes(normalizeInvestmentStatus(item.status))).length}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'rejected').length} not approved</p></div></div>
                <ul className="divide-y divide-border">{investmentRequests.map((row) => {
                  const status = normalizeInvestmentStatus(row.status)
                  const statusLabel = status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved — awaiting wallet funding' : status === 'funded' || status === 'active' ? 'Funded / active' : status === 'rejected' ? 'Not approved' : row.status.replace(/_/g, ' ')
                  const statusClass = status === 'funded' || status === 'active' ? 'text-emerald-700' : status === 'rejected' ? 'text-red-700' : status === 'approved' ? 'text-brass' : 'text-ink-soft'
                  const stages = [{ label: 'Submitted', done: true }, { label: 'Reviewed', done: ['approved', 'funded', 'active', 'completed'].includes(status) }, { label: 'Funded', done: ['funded', 'active', 'completed'].includes(status) }]
                  return <li key={row.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm">{row.property_name}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {formatMoney(row.amount, row.currency)}{row.plan_code ? ` · ${row.plan_code}` : ''}</p><p className="mt-1 text-[0.6rem] text-ink-soft">Application reference: {row.id.slice(0, 8).toUpperCase()}</p></div><span className={`eyebrow text-[0.55rem] ${statusClass}`}>{statusLabel}</span></div>
                    <div className="mt-4 grid grid-cols-3 gap-2">{stages.map((stage, index) => <div key={stage.label}><div className={`h-1.5 ${stage.done ? 'bg-brass' : 'bg-border'}`} /><p className={`mt-2 text-[0.6rem] ${stage.done ? 'text-foreground' : 'text-ink-soft'}`}>{stage.label}</p></div>)}</div>
                    {row.expected_profit !== null && row.expected_profit !== undefined ? <p className="mt-3 text-xs text-ink-soft">Estimated profit: {formatMoney(row.expected_profit, row.currency)}{row.profit_percent !== null ? ` (${row.profit_percent}%)` : ''} · Estimate only, not guaranteed.</p> : null}
                    <p className="mt-2 text-[0.65rem] leading-5 text-ink-soft">{status === 'pending' ? 'Your application has been submitted and is waiting for an administrator to review it.' : status === 'approved' ? 'Your application is approved. The next step is separate wallet funding; approval alone does not deduct funds.' : status === 'funded' || status === 'active' ? 'Your investment has been funded and recorded. Check your funded investment history for updates.' : status === 'rejected' ? 'This application was not approved and will not be funded. Contact customer support if you need clarification.' : status === 'completed' ? 'This investment record is marked completed.' : 'Your application status is shown above. Contact customer support if you need help.'}</p>
                  </li>
                })}</ul></>}
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-border bg-card"><div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5"><div><h2 className="display text-xl">Funded investments & property records</h2><p className="mt-1 text-xs text-ink-soft">Recorded investment entries and their current processing status.</p></div><Link to="/residences" className="eyebrow text-[0.5rem]">Explore projects <ArrowRight /></Link></div>
                <div className="border-b border-border px-6 py-4"><p className="eyebrow text-[0.5rem] text-ink-soft">Approved / funded record total · {currency}</p><p className="display mt-2 text-2xl">{formatMoney(fundedTotal, currency)}</p><p className="mt-1 text-xs text-ink-soft">Sum of approved, funded, active and completed investment records shown below. This is a platform record, not a guarantee of value or return.</p></div>
                {investments.length === 0 ? <div className="px-6 py-8"><p className="text-sm text-ink-soft">No funded investment records are available yet.</p><Link to="/residences" className="eyebrow mt-4 inline-flex items-center gap-2 text-[0.55rem]">Browse properties <ArrowRight /></Link></div> : <ul className="divide-y divide-border">{investments.map((row) => { const state = investmentStatus(row.status); return <li key={row.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">{row.reference || 'Property investment'}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · Record ID: {row.id.slice(0, 8)}</p><p className="mt-2 text-xs text-ink-soft">{state.detail}</p></div><div className="shrink-0 sm:text-right"><p className="display text-base">{formatMoney(row.amount, row.currency)}</p><p className={`eyebrow mt-2 text-[0.52rem] ${state.tone}`}>{state.label}</p></div></li> })}</ul>}
              </div>
              <div className="border border-border bg-card"><div className="border-b border-border px-6 py-5"><h2 className="display text-xl">Recent wallet activity</h2></div>
                {activity.length === 0 ? <p className="px-6 py-8 text-sm text-ink-soft">No posted wallet transactions yet.</p> : <ul className="divide-y divide-border">{activity.map((row) => <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm">{row.description || row.transaction_type}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {row.status}</p></div><p className="display text-base">{row.direction === 'debit' ? '−' : '+'}{formatMoney(row.amount, row.currency)}</p></li>)}</ul>}
                <div className="border-t border-border px-6 py-4"><Link to="/wallet" className="eyebrow inline-flex items-center gap-2 text-[0.55rem]">View wallet and requests <ArrowRight /></Link></div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <Link to="/account" className="group border border-border bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Profile</p><h2 className="display mt-3 text-xl">Manage your account</h2><p className="mt-2 text-sm text-ink-soft">Update your name and contact details.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Open account <ArrowRight /></span></Link>
              <Link to="/support" className="group border border-border bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Assistance</p><h2 className="display mt-3 text-xl">Customer support</h2><p className="mt-2 text-sm text-ink-soft">Send a message to the support team.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Contact support <ArrowRight /></span></Link>
              <Link to="/wallet" className="group border border-border bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Finance</p><h2 className="display mt-3 text-xl">Wallet and payments</h2><p className="mt-2 text-sm text-ink-soft">Review ledger activity and submit requests.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Open wallet <ArrowRight /></span></Link>
            </section>
            <p className="text-xs leading-relaxed text-ink-soft">Figures are based on records currently stored in the platform. Wallet balances are calculated from posted internal ledger entries; they do not represent external bank balances or completed transfers.</p>
          </> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
