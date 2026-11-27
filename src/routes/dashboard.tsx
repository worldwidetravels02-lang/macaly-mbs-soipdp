import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, BrandMark } from '../components/site-chrome'
import { Wallet, TrendingUp, Building2, House, ClipboardList, ArrowDownToLine, Headset } from 'lucide-react'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const CUSTOMER_BACKGROUND = 'https://images.pexels.com/photos/30799019/pexels-photo-30799019.jpeg?auto=compress&cs=tinysrgb&w=2400'

const meta = siteMetadata['/dashboard']
const normalizeInvestmentStatus = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
type Currency = string
type Investment = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; reference: string | null; property_id: string | null }
type InvestmentRequest = { id: string; property_name: string; plan_code: string | null; amount: number | string; currency: Currency; profit_percent: number | string | null; expected_profit: number | string | null; commission_percent: number | string | null; expected_commission: number | string | null; status: string; created_at: string }
type LedgerItem = { id: string; amount: number | string; currency: Currency; transaction_type: string; direction: string; status: string; description: string | null; created_at: string }
type Commission = { id: string; amount: number | string; currency: Currency; commission_type: string; status: string; description: string | null; created_at: string }
type WelcomeTrialBonus = { id: string; amount: number | string; currency: 'OMR'; popup_seen_at: string | null }
type MemberTask = { id: string; title: string; detail: string | null; target_level: number | null; status: string; created_at: string; reviewed_at?: string | null; review_note?: string | null }
type MembershipPlan = { id: string; level: number; name: string; minimum_amount: number | string; profit_percent: number | string; commission_percent: number | string; active: boolean }
type CustomerLevelAccess = { user_id: string; level_name: string; is_unlocked: boolean }
type BadgeProgress = { level_name: string; set_number: number; is_unlocked: boolean; progress_percent: number }
function formatMoney(amount: number | string) {
  const numeric = Number(amount)
  return new Intl.NumberFormat('en', { style: 'currency', currency: 'OMR', maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0)
}
function recordedMoney(amount: number | string, currency: Currency) {
  return currency === 'OMR' ? formatMoney(amount) : 'Legacy non-OMR record (not converted)'
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
  const [balance, setBalance] = useState(0)
  const [holdBalance, setHoldBalance] = useState(0)
  const [investments, setInvestments] = useState<Investment[]>([])
  const [investmentRequests, setInvestmentRequests] = useState<InvestmentRequest[]>([])
  const [activity, setActivity] = useState<LedgerItem[]>([])
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [unread, setUnread] = useState(0)
  const [membershipLevel, setMembershipLevel] = useState(0)
  const [memberTasks, setMemberTasks] = useState<MemberTask[]>([])
  const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([])
  const [levelAccess, setLevelAccess] = useState<CustomerLevelAccess[]>([])
  const [badgeProgress, setBadgeProgress] = useState<BadgeProgress[]>([])
  const [taskBusy, setTaskBusy] = useState<string | null>(null)
  const [taskMessage, setTaskMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [welcomeBonus, setWelcomeBonus] = useState<WelcomeTrialBonus | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const load = useCallback(async () => {
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getSession()
      if (authError) throw authError
      const current = auth.session?.user ?? null
      setUser(current)
      if (!current) { setWelcomeBonus(null); return }
      const { error: bonusEnsureError } = await client.rpc('ensure_member_trial_bonus')
      if (bonusEnsureError) {
        console.warn('Welcome Trial Bonus is not available until its database migration is applied:', bonusEnsureError.message)
        setWelcomeBonus(null)
      } else {
        const { data: bonusRow, error: bonusReadError } = await client.from('trial_bonus_transactions')
          .select('id,amount,currency,popup_seen_at')
          .eq('user_id', current.id).eq('reference_type', 'welcome_trial_bonus').maybeSingle()
        if (bonusReadError) {
          console.warn('Could not load the welcome Trial Bonus popup:', bonusReadError.message)
          setWelcomeBonus(null)
        } else {
          setWelcomeBonus(bonusRow as WelcomeTrialBonus | null)
        }
      }
      const [profile, wallet, pendingWithdrawals, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows, accessRows, badgeRows] = await Promise.all([
        client.from('profiles').select('full_name').eq('id', current.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', current.id).eq('currency', 'OMR').maybeSingle(),
        client.from('wallet_pending_withdrawals').select('pending_amount').eq('user_id', current.id).eq('currency', 'OMR').maybeSingle(),
        client.from('investments').select('id,amount,currency,status,created_at,reference,property_id').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('investment_requests').select('id,property_name,plan_code,amount,currency,profit_percent,expected_profit,commission_percent,expected_commission,status,created_at').eq('user_id', current.id).order('created_at', { ascending: false }),
        client.from('wallet_transactions').select('id,amount,currency,transaction_type,direction,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', current.id).is('read_at', null),
        client.from('commission_records').select('id,amount,currency,commission_type,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }),
        client.from('member_profiles').select('membership_level').eq('user_id', current.id).maybeSingle(),
        client.from('member_tasks').select('*').eq('user_id', current.id).order('created_at', { ascending: false }).limit(100),
        client.from('membership_plans').select('*').eq('active', true).order('level', { ascending: true }),
        client.from('customer_project_level_access').select('user_id,level_name,is_unlocked').eq('user_id', current.id),
        client.from('customer_project_set_access').select('level_name,set_number,is_unlocked,progress_percent').eq('user_id', current.id).order('level_name').order('set_number'),
      ])
      for (const result of [profile, wallet, pendingWithdrawals, projects, requests, ledger, notices, commissionRows, memberProfile, taskRows, planRows, accessRows, badgeRows]) if (result.error) throw result.error
      setName(profile.data?.full_name?.trim() || current.user_metadata?.full_name || current.email?.split('@')[0] || 'Member')
      setBalance(Number(wallet.data?.balance ?? 0))
      setHoldBalance(Number(pendingWithdrawals.data?.pending_amount ?? 0))
      setInvestments((projects.data ?? []) as Investment[])
      setInvestmentRequests((requests.data ?? []) as InvestmentRequest[])
      setActivity((ledger.data ?? []) as LedgerItem[])
      setCommissions((commissionRows.data ?? []) as Commission[])
      setMembershipLevel(Number(memberProfile.data?.membership_level ?? 0))
      setMemberTasks((taskRows.data ?? []) as MemberTask[])
      setMembershipPlans((planRows.data ?? []) as MembershipPlan[])
      setLevelAccess((accessRows.data ?? []) as CustomerLevelAccess[])
      setBadgeProgress((badgeRows.data ?? []) as BadgeProgress[])
      setUnread(notices.count ?? 0)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const syncSidebar = () => setSidebarOpen(desktop.matches)
    syncSidebar()
    desktop.addEventListener('change', syncSidebar)
    return () => desktop.removeEventListener('change', syncSidebar)
  }, [])

  useEffect(() => {
    let active = true
    const client = requireSupabase()
    const run = async () => { if (active) await load() }
    void run()
    const { data: listener } = client.auth.onAuthStateChange(() => { void run() })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [load])

  const dismissWelcomeBonus = useCallback(async () => {
    try {
      const { error: dismissError } = await requireSupabase().rpc('dismiss_member_trial_bonus_popup')
      if (dismissError) throw dismissError
      setWelcomeBonus((current) => current ? { ...current, popup_seen_at: new Date().toISOString() } : null)
    } catch (cause) {
      console.error('Could not save the welcome bonus popup status:', cause)
    }
  }, [])

  useEffect(() => {
    if (!user || !welcomeBonus || welcomeBonus.popup_seen_at) return
    const timeout = window.setTimeout(() => {
      void dismissWelcomeBonus()
    }, 5000)
    return () => window.clearTimeout(timeout)
  }, [user, welcomeBonus, dismissWelcomeBonus])

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
  const fundedTotal = investments.filter((row) => row.currency === 'OMR' && ['funded', 'active', 'approved', 'completed'].includes(normalizeInvestmentStatus(row.status))).reduce((total, row) => total + Number(row.amount), 0)
  const investmentStatus = (value: string) => {
    const status = normalizeInvestmentStatus(value)
    if (status === 'pending') return { label: 'Awaiting review', detail: 'Your application is waiting for the administration team to review it.', tone: 'text-ink-soft' }
    if (status === 'approved') return { label: 'Approved', detail: 'Approved by the administration team. Check the funding record and wallet history for the posted transaction.', tone: 'text-brass' }
    if (status === 'funded' || status === 'active') return { label: 'Funded / active', detail: 'Funding has been recorded in the platform. Review your wallet history for the related ledger entry.', tone: 'text-emerald-700' }
    if (status === 'completed') return { label: 'Completed', detail: 'This investment record is marked completed.', tone: 'text-emerald-700' }
    if (status === 'rejected') return { label: 'Not approved', detail: 'This application was not approved. Contact customer support if you need clarification.', tone: 'text-red-700' }
    return { label: value.replace(/_/g, ' '), detail: 'The administration team may update this status as the request is processed.', tone: 'text-ink-soft' }
  }

  const commissionTotals = commissions.filter((row) => row.currency === 'OMR').reduce<Record<string, { total: number; pending: number; approved: number; credited: number; rejected: number; count: number; pendingCount: number; approvedCount: number; creditedCount: number; rejectedCount: number }>>((totals, row) => {
    const key = 'OMR'
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
  const creditedCommissions = commissions.filter((row) => ['credited', 'paid', 'completed'].includes(normalizeInvestmentStatus(row.status)))
  const totalCommission = creditedCommissions.filter((row) => row.currency === 'OMR').reduce((sum, row) => sum + Number(row.amount), 0)
  const todayKey = new Date().toLocaleDateString('en-CA')
  const todayCommission = creditedCommissions.filter((row) => row.currency === 'OMR' && new Date(row.created_at).toLocaleDateString('en-CA') === todayKey).reduce((sum, row) => sum + Number(row.amount), 0)

  return (
    <div className="customer-dashboard dashboard-typography min-h-screen text-[#123c2d]" style={{ backgroundImage: `linear-gradient(rgba(8, 36, 25, 0.38), rgba(8, 36, 25, 0.48)), url("${CUSTOMER_BACKGROUND}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <WorkspaceSidebar mode="member" open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <header className={`fixed inset-x-0 top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#d8b56d]/70 bg-[#06452f]/98 px-4 text-white shadow-lg backdrop-blur transition-[left] duration-200 sm:px-6 ${sidebarOpen ? "lg:left-64" : "lg:left-0"}`}>
        <button type="button" onClick={() => setSidebarOpen((value) => !value)} aria-label={sidebarOpen ? "Close customer sidebar" : "Open customer sidebar"} aria-expanded={sidebarOpen} aria-controls="customer-sidebar" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[#d8b56d]/75 bg-[#0b5a3c] text-[#f0d28a] shadow-md transition hover:border-[#f0d28a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0d28a]">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6"><path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        </button>
        <div className="flex items-center gap-3 sm:gap-5">
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-2 py-1.5 text-xs text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d8b56d] font-semibold text-[#123c2d]">{name.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{name.split(' ')[0]}</strong><span className="text-[10px] text-white/55">Member</span></span></Link>
        </div>
      </header>

      <main id="main" className={`pb-20 pt-24 transition-[margin] duration-200 ${sidebarOpen ? "lg:ml-64" : "lg:ml-0"}`}>
        <div className="mx-auto grid w-full max-w-[1500px] gap-5 px-5 sm:px-7">
          <section className="relative overflow-hidden rounded-2xl border border-[#d8b56d]/55 bg-white/82 px-7 py-8 shadow-xl backdrop-blur-xl sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute -right-12 -top-16 h-72 w-72 rounded-full border border-[#d8b56d]/35 bg-[#d8b56d]/10" /><div className="pointer-events-none absolute bottom-0 right-0 h-1 w-2/5 bg-gradient-to-l from-[#b9974e] to-transparent" />
            <div className="relative">
              <p className="eyebrow mb-3 text-[0.58rem] tracking-[0.25em] text-[#92743a]">MSHEIREB PROPERTIES · PRIVATE MEMBER SPACE</p><h1 className="display text-3xl leading-tight text-[#123c2d] sm:text-4xl">Welcome back, {name.split(' ')[0]}.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#4c6256]">Your property journey, wallet and investment activity — together in one place.</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                <Link to="/residences" className="inline-flex items-center gap-2 rounded-md bg-[#123c2d] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0b5a3c]">Explore projects <ArrowRight /></Link>
                <Link to="/account" className="inline-flex items-center rounded-md border border-[#123c2d]/25 bg-white/55 px-5 py-3 text-sm font-semibold text-[#123c2d] transition hover:border-[#b9974e]">View account</Link>
              </div>
            </div>
          </section>

          {loading ? <div data-testid="dashboard-loading" className="border border-[#c8ad68]/55 bg-card p-10 text-center text-sm text-ink-soft">Opening your dashboard…</div> : null}
          {!loading && !user ? <section data-testid="dashboard-signed-out" className="border border-[#c8ad68]/55 bg-card p-8 sm:p-12"><p className="eyebrow text-brass">Member area</p><h2 className="display mt-4 text-2xl">Sign in to open your dashboard.</h2><p className="mt-3 text-sm text-ink-soft">Your dashboard holds your wallet, property requests, account details and customer support.</p><Link to="/login" className="eyebrow mt-6 inline-flex items-center gap-3 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link></section> : null}
          {error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {user && !loading && welcomeBonus && !welcomeBonus.popup_seen_at ? (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#061d15]/75 p-4 backdrop-blur-sm" role="presentation">
              <section role="dialog" aria-modal="true" aria-labelledby="welcome-trial-bonus-title" className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-[#d8b56d]/70 bg-gradient-to-br from-[#06452f] via-[#0b5a3c] to-[#092f23] p-7 text-center text-white shadow-[0_24px_90px_rgba(0,0,0,.45)] sm:p-9">
                <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[#d8b56d]/25" />
                <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#d8b56d]/60 bg-white/5 text-[#e6c984]">
                  <BrandMark className="h-11 w-11" />
                </div>
                <p className="eyebrow mt-6 text-[0.58rem] tracking-[0.28em] text-[#e6c984]">A WELCOME GIFT</p>
                <h2 id="welcome-trial-bonus-title" className="display mt-3 text-3xl text-white sm:text-4xl">Your Trial Bonus</h2>
                <p className="mt-3 text-sm leading-6 text-white/75">A welcome credit has been added to your Trial Bonus wallet.</p>
                <div className="my-6 rounded-2xl border border-[#e6c984]/60 bg-[#f4e6bf] px-5 py-5 text-[#123c2d] shadow-inner">
                  <p className="eyebrow text-[0.58rem] font-bold tracking-[0.25em] text-[#725923]">WELCOME CREDIT</p>
                  <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums">OMR {Number(welcomeBonus.amount).toFixed(2)}</p>
                  <p className="mt-1 text-xs font-semibold text-[#725923]">Trial Bonus Wallet</p>
                </div>
                <p className="text-xs leading-5 text-white/65">This bonus is already credited automatically. Claiming will not add another credit.</p>
                <button type="button" onClick={() => void dismissWelcomeBonus()} className="mt-6 w-full rounded-xl bg-[#e1c477] px-6 py-4 text-sm font-bold text-[#123c2d] transition hover:bg-[#f0d994]">Claim Bonus</button>
                <button type="button" onClick={() => void dismissWelcomeBonus()} className="mt-3 px-4 py-2 text-xs font-semibold text-white/70 underline underline-offset-4 hover:text-white">Dismiss</button>
              </section>
            </div>
          ) : null}

          {user && !loading ? <>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Account overview">
              <Link to="/wallet" className="group flex h-full min-h-[132px] flex-col justify-between rounded-2xl border border-[#c8ad68]/55 bg-white/80 p-5 shadow-[0_8px_24px_rgba(18,60,45,.10)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#c8ad68]">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#62766a]">Wallet balance</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f1e9]/90 text-[#0b5a3c]"><Wallet className="h-5 w-5" strokeWidth={1.8} /></span></div>
                <p data-testid="dashboard-balance" className="mt-3 text-2xl font-bold tracking-tight text-[#123c2d]">{formatMoney(balance)}</p><p className="mt-1 text-xs font-semibold text-[#718477]">Available funds · {formatMoney(holdBalance)} pending withdrawals</p>
              </Link>
              <Link to="/wallet#commissions" className="group flex h-full min-h-[132px] flex-col justify-between rounded-2xl border border-[#c8ad68]/55 bg-white/80 p-5 shadow-[0_8px_24px_rgba(18,60,45,.10)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#c8ad68]">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#62766a]">Today’s revenue</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f1e9]/90 text-[#0b5a3c]"><TrendingUp className="h-5 w-5" strokeWidth={1.8} /></span></div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-[#123c2d]">{formatMoney(todayCommission)}</p><p className="mt-1 text-xs font-semibold text-[#718477]">Today’s credited · {formatMoney(totalCommission)} total commission</p>
              </Link>
              <Link to="/orders" className="group flex h-full min-h-[132px] flex-col justify-between rounded-2xl border border-[#c8ad68]/55 bg-white/80 p-5 shadow-[0_8px_24px_rgba(18,60,45,.10)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-[#c8ad68]">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#62766a]">Total orders</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#e7f1e9]/90 text-[#0b5a3c]"><Building2 className="h-5 w-5" strokeWidth={1.8} /></span></div>
                <p className="mt-3 text-2xl font-bold tracking-tight text-[#123c2d]">{investmentRequests.filter((row) => row.plan_code === 'project_order').length}</p><p className="mt-1 text-xs font-semibold text-[#718477]">Property orders recorded</p>
              </Link>
              <section className="min-h-[132px] rounded-2xl border border-[#c8ad68]/55 bg-white/85 p-5 shadow-[0_8px_24px_rgba(18,60,45,.10)] backdrop-blur-xl" aria-label="Badge progress">
                <div className="flex items-center justify-between"><span className="text-xs font-semibold text-[#62766a]">Badge progress</span><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f5e9c9] text-[#8b6c2e]">◇</span></div>
                {badgeProgress.length ? <div className="mt-3 space-y-2">{badgeProgress.slice(0, 2).map((badge) => <div key={`${badge.level_name}-${badge.set_number}`}><div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold text-[#4f6658]"><span className="truncate">{badge.level_name} · Badge {badge.set_number}</span><span>{Math.max(0, Math.min(100, Number(badge.progress_percent) || 0))}%</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#dce7dd]"><div className="h-full rounded-full bg-[#b9974e]" style={{ width: `${Math.max(0, Math.min(100, Number(badge.progress_percent) || 0))}%` }} /></div></div>)}</div> : <p className="mt-3 text-xs font-medium leading-5 text-[#718477]">Your badge progress will appear here when badge access is set up.</p>}
                <Link to="/residences" className="mt-2 inline-flex text-[11px] font-bold text-[#8b6c2e] hover:text-[#123c2d]">View projects <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
              </section>
            </section>

            <section className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(280px,.9fr)]">
              <section aria-label="Explore Oman video" className="relative isolate w-full overflow-hidden rounded-2xl border border-[#c8ad68]/55 bg-[#123c2d] shadow-xl">
                <video
                  className="block aspect-[16/7] w-full object-cover"
                  src="https://videos.pexels.com/video-files/30048213/12888884_1920_1080_30fps.mp4"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-label="Oman luxury property showcase video"
                >
                  Your browser does not support HTML video.
                </video>
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#123c2d]/90 via-[#123c2d]/35 to-transparent px-5 pb-5 pt-16 sm:px-8 sm:pb-7">
                  <p className="eyebrow text-[0.55rem] text-[#d2b56e]">Explore Oman</p>
                  <h2 className="display mt-2 text-2xl text-white sm:text-3xl">Discover Oman</h2>
                </div>
              </section>
              <aside className="overflow-hidden rounded-2xl border border-[#c8ad68]/55 bg-white shadow-[0_8px_24px_rgba(18,60,45,.07)]">
                <div className="bg-[#075337] px-5 py-4 text-white"><h2 className="text-lg font-bold">Quick actions</h2><p className="mt-1 text-xs font-semibold text-white/70">Your account shortcuts</p></div>
                <div className="grid grid-cols-2 gap-3 p-4">
                  <Link to="/residences" className="rounded-xl border border-[#e0e9df] bg-[#f7faf6] p-4 text-center transition hover:border-[#c8ad68] hover:bg-[#edf5ed]"><span className="mx-auto grid h-9 w-9 place-items-center text-[#075337]"><House className="h-6 w-6" strokeWidth={1.8} /></span><span className="mt-2 block text-xs font-bold text-[#123c2d]">Browse properties</span></Link>
                  <Link to="/dashboard#investments" className="rounded-xl border border-[#e0e9df] bg-[#f7faf6] p-4 text-center transition hover:border-[#c8ad68] hover:bg-[#edf5ed]"><span className="mx-auto grid h-9 w-9 place-items-center text-[#075337]"><ClipboardList className="h-6 w-6" strokeWidth={1.8} /></span><span className="mt-2 block text-xs font-bold text-[#123c2d]">Investment requests</span></Link>
                  <Link to="/wallet#withdrawals" className="rounded-xl border border-[#e0e9df] bg-[#f7faf6] p-4 text-center transition hover:border-[#c8ad68] hover:bg-[#edf5ed]"><span className="mx-auto grid h-9 w-9 place-items-center text-[#075337]"><ArrowDownToLine className="h-6 w-6" strokeWidth={1.8} /></span><span className="mt-2 block text-xs font-bold text-[#123c2d]">Withdraw funds</span></Link>
                  <Link to="/support" className="rounded-xl border border-[#e0e9df] bg-[#f7faf6] p-4 text-center transition hover:border-[#c8ad68] hover:bg-[#edf5ed]"><span className="mx-auto grid h-9 w-9 place-items-center text-[#075337]"><Headset className="h-6 w-6" strokeWidth={1.8} /></span><span className="mt-2 block text-xs font-bold text-[#123c2d]">Contact support</span></Link>
                </div>
              </aside>
            </section>
            <section id="tasks-achievements" className="grid gap-6">
              <div className="border border-[#c8ad68]/55 bg-card">
                <div className="border-b border-[#dce7dd] px-6 py-5"><h2 className="display text-xl">Your assigned tasks</h2><p className="mt-1 text-xs text-ink-soft">Submit completed tasks for administrator review. Returned tasks can be submitted again.</p></div>
                {memberTasks.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No tasks have been assigned to your account yet.</p> : <ul className="divide-y divide-[#dce7dd]">{memberTasks.map((task) => {
                  const returned = ['rejected', 'returned'].includes(task.status)
                  const canSubmit = ['assigned', 'rejected', 'returned'].includes(task.status)
                  return <li key={task.id} className="flex flex-col gap-3 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{task.title}</h3><span className="eyebrow text-[0.48rem] text-brass">{task.status.replace(/_/g, ' ')}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-ink-soft">{task.detail || 'No additional task details.'}</p><p className="mt-2 text-xs text-ink-soft">Target level: {task.target_level ?? '—'} · Assigned {formatDate(task.created_at)}</p>{task.review_note ? <p className="mt-2 text-xs text-ink-soft">Admin note: {task.review_note}</p> : null}{returned ? <p className="mt-2 text-xs text-brass">This task was returned. Review the note and resubmit when complete.</p> : null}</div>
                    {canSubmit ? <button type="button" disabled={taskBusy === task.id} onClick={() => void submitTaskForReview(task)} className="eyebrow shrink-0 border border-brass/50 px-4 py-3 text-[0.52rem] disabled:opacity-50">{taskBusy === task.id ? 'Submitting…' : returned ? 'Resubmit task' : 'Submit for review'}</button> : null}
                  </li>
                })}</ul>}
              </div>
            </section>

            <section id="commissions" className="border border-[#c8ad68]/55 bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-[#dce7dd] px-6 py-5"><h2 className="display text-xl">Your commissions</h2><Link to="/wallet" className="eyebrow text-[0.5rem]">Open wallet <ArrowRight /></Link></div>
              {commissionCurrencyRows.length > 0 ? <div className="grid gap-3 border-b border-[#dce7dd] p-5 sm:grid-cols-2">{commissionCurrencyRows.map(([code, totals]) => <div key={code} className="border border-[#dce7dd] p-4"><div className="flex items-center justify-between gap-3"><p className="eyebrow text-[0.5rem] text-brass">Commission summary · OMR</p><span className="text-[0.65rem] text-ink-soft">{totals.count} records</span></div><p className="display mt-2 text-xl">{formatMoney(totals.total)}</p><div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs"><div><p className="text-ink-soft">Pending review · {totals.pendingCount}</p><p className="mt-1">{formatMoney(totals.pending)}</p></div><div><p className="text-ink-soft">Approved, not yet credited · {totals.approvedCount}</p><p className="mt-1">{formatMoney(totals.approved)}</p></div><div><p className="text-ink-soft">Credited to wallet · {totals.creditedCount}</p><p className="mt-1 text-emerald-700">{formatMoney(totals.credited)}</p></div><div><p className="text-ink-soft">Rejected · {totals.rejectedCount}</p><p className="mt-1 text-red-700">{formatMoney(totals.rejected)}</p></div></div></div>)}</div> : null}
              {commissions.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No commission records yet. Approved commissions will appear here.</p> : <><p className="px-6 py-3 text-xs text-ink-soft">Amounts are grouped by currency. Pending and approved commissions are not available in your wallet until credited.</p><ul className="divide-y divide-[#dce7dd]">{commissions.map((row) => {
                const status = normalizeInvestmentStatus(row.status)
                const completed = ['credited', 'paid', 'completed'].includes(status)
                const rejected = status === 'rejected'
                const approved = status === 'approved'
                const statusLabel = status === 'pending' ? 'Pending admin approval' : completed ? 'Credited to wallet' : rejected ? 'Rejected' : approved ? 'Approved' : row.status.replace(/_/g, ' ')
                const statusClass = completed ? 'text-emerald-700' : rejected ? 'text-red-700' : approved ? 'text-brass' : 'text-ink-soft'
                const statusDetail = status === 'pending' ? 'This commission is waiting for administrator review.' : completed ? 'This commission has been credited. Check your wallet transactions for the entry.' : rejected ? 'This commission was rejected and has not been credited.' : approved ? 'This commission is approved. Check your wallet balance and transaction history for the credit.' : 'The commission status will update when it is reviewed.'
                return <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 px-6 py-4"><div><p className="text-sm capitalize">{row.commission_type.replace(/_/g, ' ')} commission</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)}{row.description ? ` · ${row.description}` : ''}</p><p className={`eyebrow mt-2 text-[0.55rem] ${statusClass}`}>{statusLabel}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{statusDetail}</p></div><p className="display text-base">{recordedMoney(row.amount, row.currency)}</p></li>
              })}</ul></>}
            </section>
            <section id="investments" className="border border-[#c8ad68]/55 bg-card">
              <div className="flex items-center justify-between gap-3 border-b border-[#dce7dd] px-6 py-5"><h2 className="display text-xl">Investment applications</h2><Link to="/residences" className="eyebrow text-[0.5rem]">Explore properties <ArrowRight /></Link></div>
              {investmentRequests.length === 0 ? <p className="px-6 py-7 text-sm text-ink-soft">No investment applications have been submitted yet. Explore properties to find an opportunity and submit an application.</p> : <>
                <div className="grid gap-3 border-b border-[#dce7dd] p-5 sm:grid-cols-2 lg:grid-cols-4"><div className="border border-[#dce7dd] p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Total applications</p><p className="display mt-2 text-2xl">{investmentRequests.length}</p></div><div className="border border-[#dce7dd] p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Awaiting review</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'pending').length}</p></div><div className="border border-[#dce7dd] p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Approved · awaiting funding</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'approved').length}</p></div><div className="border border-[#dce7dd] p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Funded / active / completed</p><p className="display mt-2 text-2xl">{investmentRequests.filter((item) => ['funded', 'active', 'completed'].includes(normalizeInvestmentStatus(item.status))).length}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{investmentRequests.filter((item) => normalizeInvestmentStatus(item.status) === 'rejected').length} not approved</p></div></div>
                <ul className="divide-y divide-[#dce7dd]">{investmentRequests.map((row) => {
                  const status = normalizeInvestmentStatus(row.status)
                  const statusLabel = status === 'pending' ? 'Awaiting review' : status === 'approved' ? 'Approved — awaiting wallet funding' : status === 'funded' || status === 'active' ? 'Funded / active' : status === 'rejected' ? 'Not approved' : row.status.replace(/_/g, ' ')
                  const statusClass = status === 'funded' || status === 'active' ? 'text-emerald-700' : status === 'rejected' ? 'text-red-700' : status === 'approved' ? 'text-brass' : 'text-ink-soft'
                  const stages = [{ label: 'Submitted', done: true }, { label: 'Reviewed', done: ['approved', 'funded', 'active', 'completed'].includes(status) }, { label: 'Funded', done: ['funded', 'active', 'completed'].includes(status) }]
                  return <li key={row.id} className="px-6 py-5">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm">{row.property_name}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {recordedMoney(row.amount, row.currency)}{row.plan_code ? ` · ${row.plan_code}` : ''}</p><p className="mt-1 text-[0.6rem] text-ink-soft">Application reference: {row.id.slice(0, 8).toUpperCase()}</p></div><span className={`eyebrow text-[0.55rem] ${statusClass}`}>{statusLabel}</span></div>
                    <div className="mt-4 grid grid-cols-3 gap-2">{stages.map((stage, index) => <div key={stage.label}><div className={`h-1.5 ${stage.done ? 'bg-brass' : 'bg-border'}`} /><p className={`mt-2 text-[0.6rem] ${stage.done ? 'text-foreground' : 'text-ink-soft'}`}>{stage.label}</p></div>)}</div>
                    {row.expected_profit !== null && row.expected_profit !== undefined ? <p className="mt-3 text-xs text-ink-soft">Estimated profit: {recordedMoney(row.expected_profit, row.currency)}{row.profit_percent !== null ? ` (${row.profit_percent}%)` : ''} · Estimate only, not guaranteed.</p> : null}
                    <p className="mt-2 text-[0.65rem] leading-5 text-ink-soft">{status === 'pending' ? 'Your application has been submitted and is waiting for an administrator to review it.' : status === 'approved' ? 'Your application is approved. The next step is separate wallet funding; approval alone does not deduct funds.' : status === 'funded' || status === 'active' ? 'Your investment has been funded and recorded. Check your funded investment history for updates.' : status === 'rejected' ? 'This application was not approved and will not be funded. Contact customer support if you need clarification.' : status === 'completed' ? 'This investment record is marked completed.' : 'Your application status is shown above. Contact customer support if you need help.'}</p>
                  </li>
                })}</ul></>}
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-[#c8ad68]/55 bg-card"><div className="flex items-center justify-between gap-3 border-b border-[#dce7dd] px-6 py-5"><div><h2 className="display text-xl">Funded investments & property records</h2><p className="mt-1 text-xs text-ink-soft">Recorded investment entries and their current processing status.</p></div><Link to="/residences" className="eyebrow text-[0.5rem]">Explore projects <ArrowRight /></Link></div>
                <div className="border-b border-[#dce7dd] px-6 py-4"><p className="eyebrow text-[0.5rem] text-ink-soft">Approved / funded record total · OMR</p><p className="display mt-2 text-2xl">{formatMoney(fundedTotal)}</p><p className="mt-1 text-xs text-ink-soft">Sum of approved, funded, active and completed investment records shown below. This is a platform record, not a guarantee of value or return.</p></div>
                {investments.length === 0 ? <div className="px-6 py-8"><p className="text-sm text-ink-soft">No funded investment records are available yet.</p><Link to="/residences" className="eyebrow mt-4 inline-flex items-center gap-2 text-[0.55rem]">Browse properties <ArrowRight /></Link></div> : <ul className="divide-y divide-[#dce7dd]">{investments.map((row) => { const state = investmentStatus(row.status); return <li key={row.id} className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-sm font-medium">{row.reference || 'Property investment'}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · Record ID: {row.id.slice(0, 8)}</p><p className="mt-2 text-xs text-ink-soft">{state.detail}</p></div><div className="shrink-0 sm:text-right"><p className="display text-base">{recordedMoney(row.amount, row.currency)}</p><p className={`eyebrow mt-2 text-[0.52rem] ${state.tone}`}>{state.label}</p></div></li> })}</ul>}
              </div>
              <div className="border border-[#c8ad68]/55 bg-card"><div className="border-b border-[#dce7dd] px-6 py-5"><h2 className="display text-xl">Recent wallet activity</h2></div>
                {activity.length === 0 ? <p className="px-6 py-8 text-sm text-ink-soft">No posted wallet transactions yet.</p> : <ul className="divide-y divide-[#dce7dd]">{activity.map((row) => <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm">{row.description || row.transaction_type}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {row.status}</p></div><p className="display text-base">{row.direction === 'debit' ? '−' : '+'}{recordedMoney(row.amount, row.currency)}</p></li>)}</ul>}
                <div className="border-t border-[#dce7dd] px-6 py-4"><Link to="/wallet" className="eyebrow inline-flex items-center gap-2 text-[0.55rem]">View wallet and requests <ArrowRight /></Link></div>
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-3">
              <Link to="/account" className="group border border-[#c8ad68]/55 bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Profile</p><h2 className="display mt-3 text-xl">Manage your account</h2><p className="mt-2 text-sm text-ink-soft">Update your name and contact details.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Open account <ArrowRight /></span></Link>
              <Link to="/support" className="group border border-[#c8ad68]/55 bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Assistance</p><h2 className="display mt-3 text-xl">Customer support</h2><p className="mt-2 text-sm text-ink-soft">Send a message to the support team.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Contact support <ArrowRight /></span></Link>
              <Link to="/wallet" className="group border border-[#c8ad68]/55 bg-card p-6 transition-colors hover:border-brass"><p className="eyebrow text-brass">Finance</p><h2 className="display mt-3 text-xl">Wallet and payments</h2><p className="mt-2 text-sm text-ink-soft">Review ledger activity and submit requests.</p><span className="eyebrow mt-5 inline-flex items-center gap-2 text-[0.55rem]">Open wallet <ArrowRight /></span></Link>
            </section>
            <p className="text-xs leading-relaxed text-ink-soft">Figures are based on records currently stored in the platform. Wallet balances are calculated from posted internal ledger entries; they do not represent external bank balances or completed transfers.</p>
          </> : null}
        </div>
      </main>

    </div>
  )
}
