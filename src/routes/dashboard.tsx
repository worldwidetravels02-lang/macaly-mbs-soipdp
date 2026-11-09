import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/dashboard']
const currencies = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR'] as const
type Currency = (typeof currencies)[number]
type Investment = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; reference: string | null; property_id: string | null }
type InvestmentRequest = { id: string; property_name: string; plan_code: string | null; amount: number | string; currency: Currency; profit_percent: number | string | null; expected_profit: number | string | null; commission_percent: number | string | null; expected_commission: number | string | null; status: string; created_at: string }
type LedgerItem = { id: string; amount: number | string; currency: Currency; transaction_type: string; direction: string; status: string; description: string | null; created_at: string }
type Commission = { id: string; amount: number | string; currency: Currency; commission_type: string; status: string; description: string | null; created_at: string }
type MemberTask = { id: string; title: string; detail: string | null; target_level: number | null; status: string; created_at: string; reviewed_at?: string | null; review_note?: string | null }
type MembershipPlan = { id: string; level: number; name: string; minimum_amount: number | string; profit_percent: number | string; commission_percent: number | string; active: boolean }

function formatMoney(amount: number | string, currency: Currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(amount || 0))
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(value))
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
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      const current = auth.user
      setUser(current)
      if (!current) return
      const [profile, wallet, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows] = await Promise.all([
        client.from('profiles').select('full_name,preferred_currency').eq('id', current.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', current.id).eq('currency', currency).maybeSingle(),
        client.from('investments').select('id,amount,currency,status,created_at,reference,property_id').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('investment_requests').select('id,property_name,plan_code,amount,currency,profit_percent,expected_profit,commission_percent,expected_commission,status,created_at').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('wallet_transactions').select('id,amount,currency,transaction_type,direction,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', current.id).is('read_at', null),
        client.from('commission_records').select('id,amount,currency,commission_type,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }),
        client.from('member_profiles').select('membership_level').eq('user_id', current.id).maybeSingle(),
        client.from('member_tasks').select('*').eq('user_id', current.id).order('created_at', { ascending: false }).limit(100),
        client.from('membership_plans').select('*').eq('active', true).order('level', { ascending: true }),
      ])
      for (const result of [profile, wallet, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows]) if (result.error) throw result.error
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
    setTaskBusy(task.id)
    setTaskMessage('')
    try {
      const { error: updateError } = await requireSupabase().from('member_tasks').update({ status: 'submitted', submitted_at: new Date().toISOString() }).eq('id', task.id).eq('user_id', user?.id)
      if (updateError) throw updateError
      setMemberTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'submitted' } : item))
      setTaskMessage('Task submitted to the administration team for review.')
    } catch (cause) {
      setTaskMessage(cause instanceof Error ? cause.message : 'Could not submit this task.')
    } finally {
      setTaskBusy(null)
    }
  }

  const activeProjects = investments.filter((row) => ['approved', 'funded', 'active', 'completed'].includes(row.status.toLowerCase())).length
  const pendingProjects = investmentRequests.filter((row) => ['pending', 'approved'].includes(row.status.toLowerCase())).length
  const fundedTotal = investments.filter((row) => ['funded', 'active', 'approved', 'completed'].includes(row.status.toLowerCase()) && row.currency === currency).reduce((total, row) => total + (Number(row.amount) || 0), 0)
  const investmentStatus = (value: string) => {
    const status = value.toLowerCase()
    if (status === 'pending') return { label: 'Awaiting review', detail: 'Your application is waiting for the administration team to review it.', tone: 'text-ink-soft' }
    if (status === 'approved') return { label: 'Approved', detail: 'Approved by the administration team. Check the funding record and wallet history for the posted transaction.', tone: 'text-brass' }
    if (status === 'funded' || status === 'active') return { label: 'Funded / active', detail: 'Funding has been recorded in the platform. Review your wallet history for the related ledger entry.', tone: 'text-emerald-700' }
    if (status === 'completed') return { label: 'Completed', detail: 'This investment record is marked completed.', tone: 'text-emerald-700' }
    if (status === 'rejected') return { label: 'Not approved', detail: 'This application was not approved. Contact customer support if you need clarification.', tone: 'text-red-700' }
    return { label: value.replace(/_/g, ' '), detail: 'The administration team may update this status as the request is processed.', tone: 'text-ink-soft' }
  }

  const commissionTotals = commissions.reduce<Record<string, { total: number; pending: number; approved: number; credited: number; rejected: number; count: number }>>((totals, row) => {
    const key = row.currency
    const current = totals[key] ?? { total: 0, pending: 0, approved: 0, credited: 0, rejected: 0, count: 0 }
    const amount = Number(row.amount) || 0
    const status = row.status.toLowerCase()
    current.total += amount
    current.count += 1
    if (status === 'pending') current.pending += amount
    else if (status === 'approved') current.approved += amount
    else if (['credited', 'paid', 'completed'].includes(status)) current.credited += amount
    else if (status === 'rejected') current.rejected += amount
    totals[key] = current
    return totals
  }, {})
  const commissionCurrencyRows = Object.entries(commissionTotals).sort(([a], [b]) => a.localeCompare(b))

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSidebar mode="member" />
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36 lg:ml-64">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8">
          <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="eyebrow text-brass">Private member area</p><h1 className="display mt-3 text-[clamp(1.9rem,4vw,2.8rem)]">Welcome, {name.split(' ')[0]}</h1><p className="mt-2 text-sm text-ink-soft">Your account, property requests and wallet overview.</p></div>
            {user ? <div className="flex flex-wrap gap-3"><Link to="/account" className="eyebrow inline-flex items-center gap-2 border border-border px-5 py-3 text-[0.55rem]">Account <ArrowRight /></Link><Link to="/support" className="eyebrow inline-flex items-center gap-2 border border-border px-5 py-3 text-[0.55rem]">Support <ArrowRight /></Link></div> : null}
          </header>

          {loading ? <div data-testid="dashboard-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Opening your dashboard…</div> : null}
          {!loading && !user ? <section data-testid="dashboard-signed-out" className="border border-border bg-card p-8 sm:p-12"><p className="eyebrow text-brass">Member area</p><h2 className="display mt-4 text-2xl">Sign in to open your dashboard.</h2><p className="mt-3 text-sm text-ink-soft">Your dashboard holds your wallet, property requests, account details and customer support.</p><Link to="/login" className="eyebrow mt-6 inline-flex items-center gap-3 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link></section> : null}
          {error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {user && !loading ? <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-brass/40 bg-brass/5 p-6"><p className="eyebrow text-[0.5rem] text-brass">Wallet balance · {currency}</p><p data-testid="dashboard-balance" className="display mt-3 text-2xl">{formatMoney(balance, currency)}</p><Link to="/wallet" className="eyebrow mt-4 inline-flex items-center gap-2 text-[0.5rem]">Open wallet <ArrowRight /></Link></div>
              <div className="border border-border bg-card p-6"><p className="eyebrow text-[0.5rem] text-ink-soft">Property requests</p><p className="display mt-3 text-2xl">{investments.length}</p><p className="mt-2 text-xs text-ink-soft">{pendingProjects} pending review</p></div>
              <div className="border border-border bg-card p-6"><p className="eyebrow text-[0.5rem] text-ink-soft">Approved / funded</p><p className="display mt-3 text-2xl">{activeProjects}</p><p className="mt-2 text-xs text-ink-soft">Requests approved or completed</p></div>
              <div className="border border-border bg-card p-6"><p className="eyebrow text-[0.5rem] text-ink-soft">Unread notifications</p><p className="display mt-3 text-2xl">{unread}</p><p className="mt-2 text-xs text-ink-soft">Updates on your account</p></div>
            </section>

            <section id="investment-level" className="border border-brass/40 bg-brass/5 p-6">
              <p className="eyebrow text-[0.5rem] text-brass">Your investment level</p>
              <h2 className="display mt-2 text-2xl">Level {membershipLevel}</h2>
              <p className="mt-2 text-sm text-ink-soft">Your membership level is assigned and updated by the administration team.</p>
            </section>
            <section id="tasks-achievements" className="grid gap-6">
              <div className="border border-brass/40 bg-brass/5 p-6 sm:p-8">
                <p className="eyebrow text-[0.5rem] text-brass">Tasks & achievements</p>
                <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                  <div><h2 className="display text-2xl">Level {membershipLevel}</h2><p className="mt-2 text-sm text-ink-soft">Your current achievement level is managed by the administration team.</p></div>
                  <span className="eyebrow border border-brass/40 px-3 py-2 text-[0.5rem] text-brass">{memberTasks.filter((task) => task.status === 'approved').length} tasks approved</span>
                </div>
                {taskMessage ? <p role="status" className="mt-4 border border-brass/30 px-4 py-3 text-sm">{taskMessage}</p> : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {membershipPlans.map((plan) => {
                  const unlocked = Number(plan.level) <= membershipLevel
                  const levelTasks = memberTasks.filter((task) => Number(task.target_level ?? 0) === Number(plan.level))
                  const approved = levelTasks.filter((task) => task.status === 'approved').length
                  const progress = levelTasks.length ? Math.round((approved / levelTasks.length) * 100) : 0
                  return <article key={plan.id} className={['border p-5', unlocked ? 'border-brass/50 bg-brass/5' : 'border-border bg-card'].join(' ')}>
                    <div className="flex items-center justify-between gap-3"><p className="eyebrow text-[0.5rem] text-brass">Achievement level {plan.level}</p><span className="text-xs">{unlocked ? 'Unlocked' : '🔒 Locked'}</span></div>
                    <h3 className="display mt-3 text-xl">{plan.name}</h3>
                    <p className="mt-2 text-xs text-ink-soft">Minimum investment: {formatMoney(plan.minimum_amount, currency)}</p>
                    <p className="mt-1 text-xs text-ink-soft">Approved tasks: {approved}/{levelTasks.length}</p>
                    {levelTasks.length > 0 ? <div className="mt-3"><div className="mb-1 flex justify-between text-[0.65rem] text-ink-soft"><span>Assigned-task completion</span><span>{progress}%</span></div><div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-brass" style={{ width: progress + '%' }} /></div></div> : <p className="mt-3 text-xs text-ink-soft">No tasks have been assigned for this level yet.</p>}
                    {!unlocked ? <p className="mt-3 text-xs text-ink-soft">This level has not yet been assigned to your account.</p> : <p className="mt-3 text-xs text-brass">Achievement unlocked on your account.</p>}
                  </article>
                })}
                {membershipPlans.length === 0 ? <p className="border border-border bg-card p-5 text-sm text-ink-soft">Achievement levels will appear here when the administration team activates membership plans.</p> : null}
              </div>
              <div className="border border-border bg-card">
                <div className="border-b border-border px-6 py-5"><h2 className="display text-xl">Your assigned tasks</h2><p className="mt-1 text-xs text-ink-soft">Submit completed tasks for administrator review. Returned tasks can be submitted again.</p></div>
                {memberTasks.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No tasks have been assigned to your account yet.</p> : <ul className="divide-y divide-border">{memberTasks.map((task) => {
                  const returned = ['rejected', 'returned'].includes(task.status)
                  const canSubmit = ['assigned', 'rejected'].includes(task.status)
                  return <li key={task.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{task.title}</h3><span className="eyebrow text-[0.48rem] text-brass">{task.status.replace(/_/g, ' ')}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{task.detail || 'No additional task details.'}</p><p className="mt-2 text-xs text-ink-soft">Target level: {task.target_level ?? '—'} · Assigned {formatDate(task.created_at)}</p>{task.review_note ? <p className="mt-2 text-xs text-ink-soft">Admin note: {task.review_note}</p> : null}{returned ? <p className="mt-2 text-xs text-brass">This task was returned. Review the note and resubmit when complete.</p> : null}</div>
                    {canSubmit ? <button type="button" disabled={taskBusy === task.id} onClick={() => void submitTaskForReview(task)} className="eyebrow shrink-0 border border-brass/50 px-4 py-3 text-[0.52rem] disabled:opacity-50">{taskBusy === task.id ? 'Submitting…' : returned ? 'Resubmit task' : 'Submit for review'}</button> : null}
                  </li>
                })}</ul>}
              </div>
            </section>

            <section id="commissions" className="border border-border bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5"><h2 className="display text-xl">Your commissions</h2><Link to="/wallet" className="eyebrow text-[0.5rem]">Open wallet <ArrowRight /></Link></div>
              {commissionCurrencyRows.length > 0 ? <div className="grid gap-3 border-b border-border p-5 sm:grid-cols-2">{commissionCurrencyRows.map(([code, totals]) => <div key={code} className="border border-border/70 p-4"><div className="flex items-center justify-between gap-3"><p className="eyebrow text-[0.5rem] text-brass">Commission summary · {code}</p><span className="text-[0.65rem] text-ink-soft">{totals.count} records</span></div><p className="display mt-2 text-xl">{formatMoney(totals.total, code as Currency)}</p><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><p className="text-ink-soft">Pending review</p><p className="mt-1">{formatMoney(totals.pending, code as Currency)}</p></div><div><p className="text-ink-soft">Approved, not yet credited</p><p className="mt-1">{formatMoney(totals.approved, code as Currency)}</p></div><div><p className="text-ink-soft">Credited to wallet</p><p className="mt-1 text-emerald-700">{formatMoney(totals.credited, code as Currency)}</p></div><div><p className="text-ink-soft">Rejected</p><p className="mt-1 text-red-700">{formatMoney(totals.rejected, code as Currency)}</p></div></div></div>)}</div> : null}
              {commissions.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No commission records yet. Approved commissions will appear here.</p> : <><p className="px-6 py-3 text-xs text-ink-soft">Amounts are grouped by currency. Pending and approved commissions are not available in your wallet until credited.</p><ul className="divide-y divide-border">{commissions.map((row) => {
                const status = row.status.toLowerCase()
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
              {investmentRequests.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No investment applications have been submitted yet.</p> : <ul className="divide-y divide-border">{investmentRequests.map((row) => {
                const status = row.status.toLowerCase()
                const statusLabel = status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved — awaiting wallet funding' : status === 'funded' || status === 'active' ? 'Funded / active' : status === 'rejected' ? 'Not approved' : row.status.replace(/_/g, ' ')
                const statusClass = status === 'funded' || status === 'active' ? 'text-emerald-700' : status === 'rejected' ? 'text-red-700' : status === 'approved' ? 'text-brass' : 'text-ink-soft'
                return <li key={row.id} className="px-6 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm">{row.property_name}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {formatMoney(row.amount, row.currency)}{row.plan_code ? ` · ${row.plan_code}` : ''}</p></div><span className={`eyebrow text-[0.55rem] ${statusClass}`}>{statusLabel}</span></div>
                  {row.expected_profit !== null && row.expected_profit !== undefined ? <p className="mt-2 text-xs text-ink-soft">Estimated profit: {formatMoney(row.expected_profit, row.currency)}{row.profit_percent !== null ? ` (${row.profit_percent}%)` : ''}</p> : null}
                  <p className="mt-1 text-[0.65rem] text-ink-soft">{status === 'pending' ? 'Your application is waiting for an administrator to review it.' : status === 'approved' ? 'Your application is approved. Funding is still subject to wallet balance and administrator processing.' : status === 'funded' || status === 'active' ? 'Your investment has been funded and recorded.' : status === 'rejected' ? 'This application was not approved. Contact support if you need clarification.' : 'Check this application status for the latest update.'}</p>
                </li>
              })}</ul>}
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
