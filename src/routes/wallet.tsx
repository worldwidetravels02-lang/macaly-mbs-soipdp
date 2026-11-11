import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/wallet']
const currencies = ['OMR', 'AED', 'SAR', 'KWD', 'BHD', 'QAR', 'PKR', 'BDT'] as const
type Currency = (typeof currencies)[number]
type WalletRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; description?: string | null; transaction_type?: string; direction?: string }
type ProfitRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string }
type CommissionRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; commission_type: string; description: string | null }
type RequestRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; admin_note?: string | null; payout_method?: string | null; payout_details?: Record<string, unknown> | null }
type WalletNotification = { id: string; title: string; body: string; read_at: string | null; created_at: string }

const fieldClass = 'mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60'

function money(value: number | string, currency: Currency) {
  const numeric = Number(value)
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(numeric) ? numeric : 0)
}
type FxRates = Record<Currency, number>
const emptyFxRates: FxRates = { OMR: 1, AED: 9.55, SAR: 9.7549, KWD: 0.7978, BHD: 0.9805, QAR: 9.4836, PKR: 729, BDT: 313.1 }
function convertCurrency(value: number | string, from: Currency, to: Currency, rates: FxRates) {
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  if (from === to) return amount
  const fromRate = rates[from], toRate = rates[to]
  return fromRate > 0 && toRate > 0 ? amount / fromRate * toRate : amount
}
function normalizeStatus(value: unknown) { return String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_') }
function displayStatus(value: unknown) {
  const status = normalizeStatus(value)
  return status ? status.replace(/_/g, ' ') : 'status unavailable'
}
function date(value: string) {
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(timestamp)
    : 'Date unavailable'
}

export const Route = createFileRoute('/wallet')({
  head: () => {
    const canonical = canonicalUrl('/wallet')
    return {
      meta: [{ title: meta.title }, { name: 'description', content: meta.description }],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: WalletPage,
})

function WalletPage() {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [currency, setCurrency] = useState<Currency>('OMR')
  const [fxRates, setFxRates] = useState<FxRates>(emptyFxRates)
  const [fxDate, setFxDate] = useState('')
  const [fxError, setFxError] = useState('')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<WalletRow[]>([])
  const [transactionLimit, setTransactionLimit] = useState(30)
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'credit' | 'debit'>('all')
  const [transactionSearch, setTransactionSearch] = useState('')
  const [transactionFromDate, setTransactionFromDate] = useState('')
  const [transactionToDate, setTransactionToDate] = useState('')
  const [profits, setProfits] = useState<ProfitRow[]>([])
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [topups, setTopups] = useState<RequestRow[]>([])
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([])
  const [notifications, setNotifications] = useState<WalletNotification[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [payoutMethod, setPayoutMethod] = useState('Bank transfer')
  const [payoutDetails, setPayoutDetails] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadWallet = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const client = requireSupabase()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!authData.user) {
        setUserId(null)
        setLoading(false)
        return
      }
      setUserId(authData.user.id)
      const [profileResult, balanceResult, transactionResult, profitResult, commissionResult, topupResult, withdrawalResult, notificationResult] = await Promise.all([
        client.from('profiles').select('preferred_currency').eq('id', authData.user.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', authData.user.id).eq('currency', 'OMR').maybeSingle(),
        client.from('wallet_transactions').select('id,amount,currency,status,created_at,description,transaction_type,direction').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(transactionLimit),
        client.from('profit_payouts').select('id,amount,currency,status,created_at').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
        client.from('commission_records').select('id,amount,currency,status,created_at,commission_type,description').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('topup_requests').select('id,amount,currency,status,created_at,admin_note').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('withdrawal_requests').select('id,amount,currency,status,created_at,admin_note,payout_method,payout_details').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('notifications').select('id,title,body,read_at,created_at').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
      ])
      const checks = [
        ['profiles', profileResult],
        ['wallet_balances', balanceResult],
        ['wallet_transactions', transactionResult],
        ['profit_payouts', profitResult],
        ['commission_records', commissionResult],
        ['topup_requests', topupResult],
        ['withdrawal_requests', withdrawalResult],
        ['notifications', notificationResult],
      ] as const
      for (const [table, result] of checks) {
        if (result.error) {
          const detail = result.error.message || 'Unknown database error'
          throw new Error(`Wallet could not load ${table}: ${detail}`)
        }
      }
      const savedCurrency = profileResult.data?.preferred_currency
      if (savedCurrency && currencies.includes(savedCurrency as Currency) && savedCurrency !== currency) {
        setCurrency(savedCurrency as Currency)
        return
      }
      setBalance(Number(balanceResult.data?.balance ?? 0))
      setTransactions((transactionResult.data ?? []) as WalletRow[])
      setProfits((profitResult.data ?? []) as ProfitRow[])
      setCommissions((commissionResult.data ?? []) as CommissionRow[])
      setTopups((topupResult.data ?? []) as RequestRow[])
      setWithdrawals((withdrawalResult.data ?? []) as RequestRow[])
      setNotifications((notificationResult.data ?? []) as WalletNotification[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your wallet.')
    } finally {
      setLoading(false)
    }
  }, [currency, transactionLimit])

  // Keep the wallet currency selector in sync with the shared dashboard selector.
  useEffect(() => {
    const syncCurrency = (event: Event) => {
      const nextCurrency = (event as CustomEvent<unknown>).detail
      if (typeof nextCurrency === 'string' && currencies.includes(nextCurrency as Currency)) {
        setCurrency(nextCurrency as Currency)
      }
    }
    window.addEventListener('msheireb-currency-change', syncCurrency)
    return () => window.removeEventListener('msheireb-currency-change', syncCurrency)
  }, []) // msheireb-currency-sync-listener

    useEffect(() => {
    let active = true
    async function loadFxRates() {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/OMR', { cache: 'no-store' })
        if (!response.ok) throw new Error('Live exchange-rate service is temporarily unavailable.')
        const payload = await response.json() as { result?: string; base_code?: string; time_last_update_utc?: string; rates?: Record<string, number> }
        if (payload.result !== 'success' || payload.base_code !== 'OMR' || !payload.rates) throw new Error('The exchange-rate response was invalid.')
        const next: FxRates = { ...emptyFxRates, OMR: 1 }
        for (const code of currencies) {
          const rate = Number(payload.rates[code])
          if (code !== 'OMR' && Number.isFinite(rate) && rate > 0) next[code] = rate
        }
        const missing = currencies.filter((code) => !Number.isFinite(next[code]) || next[code] <= 0)
        if (missing.length) throw new Error('Live rates unavailable for: ' + missing.join(', '))
        if (active) {
          setFxRates(next)
          setFxDate(payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toLocaleString('en-GB') : new Date().toLocaleString('en-GB'))
          setFxError('')
        }
      } catch (cause) {
        if (active) {
          setFxRates((current) => Object.values(current).some((rate) => rate > 0) ? current : emptyFxRates)
          setFxError(cause instanceof Error ? cause.message : 'Live rates unavailable; using reference rates.')
        }
      }
    }
    void loadFxRates()
    const refresh = window.setInterval(() => { void loadFxRates() }, 5 * 60 * 1000)
    window.addEventListener('focus', loadFxRates)
    void loadWallet()
    const client = requireSupabase()
    const { data: listener } = client.auth.onAuthStateChange(() => { void loadWallet() })
    return () => {
      active = false
      window.clearInterval(refresh)
      window.removeEventListener('focus', loadFxRates)
      listener.subscription.unsubscribe()
    }
  }, [loadWallet])

  async function submitWalletRequest(kind: 'deposit' | 'withdrawal') {
    const rawAmount = kind === 'deposit' ? depositAmount : withdrawalAmount
    const enteredAmount = Number(rawAmount)
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0 || enteredAmount > 100000000 || !/^\\d+(?:\\.\\d{1,2})?$/.test(rawAmount.trim())) { setError('Enter a valid amount with no more than 2 decimal places (maximum 100,000,000).'); return }
    if (currency !== 'OMR' && (!fxRates[currency] || fxRates[currency] <= 0)) { setError('The exchange rate is unavailable. Please try again later.'); return }
    const amount = convertCurrency(enteredAmount, currency, 'OMR', fxRates)
    const method = payoutMethod.trim()
    const details = payoutDetails.trim()
    if (kind === 'withdrawal') {
      if (!['Bank transfer', 'Other'].includes(method)) { setError('Choose a supported withdrawal method.'); return }
      if (!details || details.length > 1000) { setError('Enter payout instructions between 1 and 1,000 characters.'); return }
      const reservedWithdrawals = withdrawals
        .filter((row) => row.currency === 'OMR' && ['pending', 'submitted', 'under_review', 'approved', 'processing', 'in_progress'].includes(normalizeStatus(row.status)))
        .reduce((total, row) => total + (Number(row.amount) || 0), 0)
      if (amount + reservedWithdrawals > balance) {
        setError(`Your request plus ${money(convertCurrency(reservedWithdrawals, 'OMR', currency, fxRates), currency)} in pending or approved withdrawals would exceed your available posted balance.`)
        return
      }
    }
    setRequestBusy(true); setError(''); setNotice('')
    try {
      const client = requireSupabase()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Please sign in again.')
      if (kind === 'withdrawal') {
        const { data: latestWithdrawals, error: latestError } = await client
          .from('withdrawal_requests')
          .select('amount, currency, status')
          .eq('user_id', authData.user.id)
          .eq('currency', 'OMR')
        if (latestError) throw latestError
        const activeStatuses = ['pending', 'submitted', 'under_review', 'approved', 'processing', 'in_progress']
        const latestReserved = (latestWithdrawals ?? [])
          .filter((row) => activeStatuses.includes(String(row.status ?? '').toLowerCase().replace(/-/g, '_')))
          .reduce((total, row) => total + (Number(row.amount) || 0), 0)
        if (amount + latestReserved > balance) {
          throw new Error(`Your available balance has changed. Existing active withdrawals reserve ${money(convertCurrency(latestReserved, 'OMR', currency, fxRates), currency)}. Refresh your wallet and try again.`)
        }
      }
      const table = kind === 'deposit' ? 'topup_requests' : 'withdrawal_requests'
      const requestPayload = kind === 'withdrawal'
        ? { user_id: authData.user.id, amount, currency: 'OMR', status: 'pending', payout_method: method, payout_details: { instructions: details } }
        : { user_id: authData.user.id, amount, currency: 'OMR', status: 'pending' }
      const { error: insertError } = await client.from(table).insert(requestPayload)
      if (insertError) throw insertError
      if (kind === 'deposit') {
        setDepositAmount('')
        setNotice('Your deposit request was submitted. Please contact customer support for the next instructions.')
      } else {
        setWithdrawalAmount('')
        setPayoutDetails('')
        setNotice('Your withdrawal request was submitted and is awaiting administrator review.')
      }
      await loadWallet()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit your request.') }
    finally { setRequestBusy(false) }
  }
  async function markNotificationsRead() {
    if (!userId || notifications.every((item) => item.read_at)) return
    setError('')
    try {
      const { error: updateError } = await requireSupabase().from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', userId)
        .is('read_at', null)
      if (updateError) throw updateError
      await loadWallet()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark notifications as read.')
    }
  }

  async function changeCurrency(nextCurrency: Currency) {
    setError('')
    if (userId) {
      try {
        const { error: updateError } = await requireSupabase().from('profiles')
          .update({ preferred_currency: nextCurrency }).eq('id', userId)
        if (updateError) throw updateError
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your preferred currency.')
        return
      }
    }
    setCurrency(nextCurrency)
    try { window.localStorage.setItem('msheireb-currency', nextCurrency) } catch { /* optional */ }
    window.dispatchEvent(new CustomEvent('msheireb-currency-change', { detail: nextCurrency }))
  }

  const reservedWithdrawalAmount = withdrawals
    .filter((row) => row.currency === 'OMR' && ['pending', 'submitted', 'under_review', 'approved', 'processing', 'in_progress'].includes(normalizeStatus(row.status)))
    .reduce((total, row) => total + (Number(row.amount) || 0), 0)
  const withdrawableAmount = Math.max(0, balance - reservedWithdrawalAmount)
  const displayMoney = (value: number | string, source: Currency) => money(convertCurrency(value, source, currency, fxRates), currency)

  const currencyTransactions = transactions
  const getTransactionDirection = (row: WalletRow): 'credit' | 'debit' | 'unknown' => {
    const direction = normalizeStatus(row.direction)
    if (direction === 'credit' || direction === 'debit') return direction
    const type = normalizeStatus(row.transaction_type)
    if (/(^|_)(debit|withdrawal|withdraw|payment_out|purchase|charge)(_|$)/.test(type)) return 'debit'
    if (/(^|_)(credit|deposit|topup|top_up|profit|commission|refund|payment_in)(_|$)/.test(type)) return 'credit'
    return 'unknown'
  }
  const visibleTransactions = currencyTransactions.filter((row) => {
    const matchesDirection = transactionFilter === 'all' || getTransactionDirection(row) === transactionFilter
    const query = transactionSearch.trim().toLowerCase()
    const matchesSearch = !query || [row.id, row.description, row.transaction_type, row.status, row.amount, row.created_at]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
    const transactionDate = String(row.created_at ?? '').slice(0, 10)
    const matchesFromDate = !transactionFromDate || transactionDate >= transactionFromDate
    const matchesToDate = !transactionToDate || transactionDate <= transactionToDate
    return matchesDirection && matchesSearch && matchesFromDate && matchesToDate
  })

  return (
    <div className="dashboard-typography min-h-screen bg-background text-foreground">
      <WorkspaceSidebar mode="member" />
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36 lg:ml-64">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8">
          <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-brass">Member account</p>
              <h1 className="display mt-3 text-[clamp(1.8rem,4vw,2.6rem)]">Your wallet</h1>
              <p className="mt-2 text-sm text-ink-soft">View your posted balance, request deposits, and track wallet activity.</p>
            </div>
            <label className="block min-w-36">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Display currency</span>
              <select className={fieldClass} value={currency} onChange={(event) => { void changeCurrency(event.target.value as Currency) }}>
                {currencies.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
          </header>

          {loading ? <div data-testid="wallet-loading" className="border border-border bg-card p-8 text-center text-sm text-ink-soft">Loading your wallet…</div> : null}
          {!loading && !userId ? (
            <section data-testid="wallet-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Member wallet</p>
              <h2 className="display mt-3 text-2xl">Sign in to view your wallet.</h2>
              <Link to="/login" className="eyebrow mt-6 inline-flex items-center gap-3 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground">Login <ArrowRight /></Link>
            </section>
          ) : null}
          {error ? <p role="alert" data-testid="wallet-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" data-testid="wallet-notice" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm">{notice}</p> : null}

          {userId && !loading ? <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-brass/40 bg-brass/5 p-6">
                <p className="eyebrow text-[0.5rem] text-brass">Posted wallet balance</p>
                <p data-testid="wallet-balance" className="display mt-3 text-3xl">{money(convertCurrency(balance, 'OMR', currency, fxRates), currency)}</p>
                <p className="mt-2 text-xs text-ink-soft">Base balance: {money(balance, 'OMR')}</p>
                <p className="mt-1 text-xs text-ink-soft">{currency === 'OMR' ? 'OMR is the wallet base currency.' : fxRates[currency] ? `1 OMR = ${fxRates[currency].toFixed(6)} ${currency}` : 'Exchange rate unavailable.'} {fxDate ? `Rate updated: ${fxDate}` : 'Reference rates in use.'} · Auto-refresh every 5 minutes.</p>
                {fxError ? <p role="status" className="mt-1 text-xs text-amber-700">{fxError} Reference rates are being used until live rates return.</p> : null}
                <p className="mt-2 text-xs text-ink-soft">Calculated from posted ledger entries only.</p>
                <p className="mt-2 text-xs text-ink-soft">Reserved in pending, approved or processing withdrawals: {money(convertCurrency(reservedWithdrawalAmount, 'OMR', currency, fxRates), currency)}. New requests are checked against this amount.</p>
              </div>
              <div className="border border-border bg-card p-6">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Credited profit total</p>
                <p className="display mt-3 text-2xl">{money(profits.filter((row) => row.status === 'credited').reduce((total, row) => total + convertCurrency(row.amount, row.currency, currency, fxRates), 0), currency)}</p>
                <p className="mt-2 text-xs text-ink-soft">Posted profit payout records in {currency}.</p>
              </div>
              <div className="border border-border bg-card p-6">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Profit credit records</p>
                <p className="display mt-3 text-2xl">{profits.filter((row) => row.status === 'credited' && row.currency === currency).length}</p>
                <p className="mt-2 text-xs text-ink-soft">Credited payout records in {currency}.</p>
              </div>
            </section>


            <section className="grid gap-6 lg:grid-cols-2">
              <form id="deposits" onSubmit={(event) => { event.preventDefault(); void submitWalletRequest('deposit') }} className="grid gap-3 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Add funds</p><h2 className="display mt-2 text-xl">Deposit request</h2><p className="mt-2 text-xs leading-6 text-ink-soft">Enter the amount and submit a request. Then contact customer support for instructions. No payment is taken on this page.</p></div>
                <label className="text-xs text-ink-soft">Deposit amount ({currency})<input required type="number" min="0.01" max="100000000" step="0.01" className={fieldClass} value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="Enter amount" /></label>
                <button disabled={requestBusy || !depositAmount} className="eyebrow inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.6rem] text-primary-foreground disabled:opacity-50">Submit deposit request <ArrowRight /></button>
                <Link to="/support" className="text-sm text-brass underline underline-offset-4">Contact customer support for deposit instructions</Link>
              </form>
              <section id="withdrawals" className="grid content-start gap-3 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Withdraw funds</p><h2 className="display mt-2 text-xl">Contact customer support</h2><p className="mt-2 text-xs leading-6 text-ink-soft">To ask about withdrawing your funds, contact our customer support team. The withdrawal request form is not available in the customer wallet.</p></div>
                <Link to="/support" className="eyebrow inline-flex w-fit items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.6rem] text-primary-foreground">Contact support <ArrowRight /></Link>
              </section>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
            {notifications.length > 0 ? <section id="notifications" className="border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="display text-lg">Wallet notifications</h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-soft">{notifications.filter((item) => !item.read_at).length} unread</span>
                  {notifications.some((item) => !item.read_at) ? <button type="button" onClick={() => { void markNotificationsRead() }} className="text-xs text-brass underline underline-offset-4">Mark all as read</button> : null}
                </div>
              </div>
              <ul className="divide-y divide-border">
                {notifications.map((item) => <li key={item.id} className="px-6 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">{item.title}</p>
                    {!item.read_at ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brass" aria-label="Unread" /> : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-ink-soft">{item.body}</p>
                  <p className="mt-2 text-xs text-ink-soft">{date(item.created_at)}</p>
                </li>)}
              </ul>
            </section> : null}
              <RequestHistory title="Deposit requests" rows={topups} kind="deposit" displayCurrency={currency} rates={fxRates} />
              <RequestHistory title="Withdrawal requests" rows={withdrawals} kind="withdrawal" displayCurrency={currency} rates={fxRates} />
            </section>
            <section className="grid gap-6 lg:grid-cols-3">
              <History title="Profit credits" rows={profits} displayCurrency={currency} rates={fxRates} />
              <CommissionHistory rows={commissions} displayCurrency={currency} rates={fxRates} />
              <div id="transactions" className="border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
                  <h2 className="display text-lg">Wallet activity</h2>
                  <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
                    <div className="sm:col-span-2 lg:col-span-1">
                      <label className="sr-only" htmlFor="wallet-activity-search">Search wallet activity</label>
                      <input id="wallet-activity-search" type="search" value={transactionSearch} onChange={(event) => setTransactionSearch(event.target.value)} placeholder="Search description, type, status or amount" className={fieldClass} />
                    </div>
                    <div>
                      <label className="sr-only" htmlFor="wallet-activity-from">From date</label>
                      <input id="wallet-activity-from" aria-label="Wallet activity from date" type="date" value={transactionFromDate} max={transactionToDate || undefined} onChange={(event) => setTransactionFromDate(event.target.value)} className={fieldClass} />
                    </div>
                    <div>
                      <label className="sr-only" htmlFor="wallet-activity-to">To date</label>
                      <input id="wallet-activity-to" aria-label="Wallet activity to date" type="date" value={transactionToDate} min={transactionFromDate || undefined} onChange={(event) => setTransactionToDate(event.target.value)} className={fieldClass} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2" aria-label="Filter wallet activity">
                    {(['all', 'credit', 'debit'] as const).map((filter) => <button key={filter} type="button" aria-pressed={transactionFilter === filter} onClick={() => setTransactionFilter(filter)} className={`border px-3 py-2 text-xs capitalize transition-colors ${transactionFilter === filter ? 'border-brass bg-brass/10 text-brass' : 'border-border text-ink-soft hover:border-brass'}`}>{filter === 'all' ? 'All' : filter === 'credit' ? 'Credits' : 'Debits'}</button>)}
                    <button type="button" onClick={() => { setTransactionSearch(''); setTransactionFilter('all'); setTransactionFromDate(''); setTransactionToDate('') }} className="border border-border px-3 py-2 text-xs text-ink-soft hover:border-brass" disabled={!transactionSearch && transactionFilter === 'all' && !transactionFromDate && !transactionToDate}>Clear filters</button>
                  </div>
                </div>
                {currencyTransactions.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No posted wallet activity yet.</p> : visibleTransactions.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No matching wallet activity found in {currency}.</p> : <><ul data-testid="wallet-transactions" className="divide-y divide-border">{visibleTransactions.map((row) => { const direction = getTransactionDirection(row); const sign = direction === 'debit' ? '−' : direction === 'credit' ? '+' : ''; const amountTone = direction === 'debit' ? 'text-destructive' : direction === 'credit' ? 'text-emerald-700' : 'text-foreground'; const label = row.transaction_type?.replace(/_/g, ' ') || 'Wallet transaction'; return <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.description || label}</p><p className="mt-1 text-xs capitalize text-ink-soft">{label} · {direction === 'unknown' ? 'Direction not specified' : direction}</p><p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {displayStatus(row.status)}</p></div><p className={`display shrink-0 text-lg ${amountTone}`}>{sign}{displayMoney(row.amount, row.currency)}</p></li> })}</ul><div className="border-t border-border px-6 py-3"><p className="text-xs text-ink-soft">Showing {visibleTransactions.length} matching transactions from {currencyTransactions.length} loaded records, converted to {currency}.</p>{transactions.length === transactionLimit ? <button type="button" onClick={() => setTransactionLimit((current) => current + 30)} className="mt-3 text-xs text-brass underline underline-offset-4">Load 30 more {transactionFilter === 'all' ? '' : `${transactionFilter} `}transactions</button> : null}</div></>}
              </div>
            </section>
            <p className="text-xs leading-relaxed text-ink-soft">Wallet entries and profit credits shown here are internal platform records. They are not proof of a bank transfer, regulated investment return, or external payment settlement.</p>
          </> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}




function RequestHistory({ title, rows, kind, displayCurrency, rates }: { title: string; rows: RequestRow[]; kind: 'deposit' | 'withdrawal'; displayCurrency: Currency; rates: FxRates }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'not_approved'>('all')
  const statusInfo = (rawStatus: string) => {
    const status = normalizeStatus(rawStatus)
    if (['pending', 'submitted', 'under_review'].includes(status)) {
      return { group: 'active' as const, label: 'Pending administrator review', detail: kind === 'deposit' ? 'Your request is recorded. Contact customer support for deposit instructions; funds are not added until an administrator processes it.' : 'Your request is waiting for administrator review. The amount has not been paid out.', tone: 'text-brass' }
    }
    if (['approved', 'processing', 'in_progress'].includes(status)) {
      return { group: 'active' as const, label: status === 'approved' ? 'Approved' : 'Processing', detail: kind === 'deposit' ? 'Your request has been approved. Check your wallet activity after the administrator posts the credit.' : 'Your withdrawal is approved but is not confirmed as paid yet.', tone: 'text-brass' }
    }
    if (['paid', 'completed', 'credited', 'successful', 'succeeded'].includes(status)) {
      return { group: 'completed' as const, label: kind === 'deposit' ? 'Completed / credited' : 'Paid / completed', detail: 'This request is marked complete. Check wallet activity for the posted transaction where applicable.', tone: 'text-emerald-700' }
    }
    if (['rejected', 'declined', 'cancelled', 'canceled', 'failed'].includes(status)) {
      return { group: 'not_approved' as const, label: 'Not approved', detail: 'This request was not completed. Contact customer support if you need an explanation.', tone: 'text-red-700' }
    }
    return { group: 'other' as const, label: rawStatus.replace(/_/g, ' '), detail: 'The administrator has updated this request. Contact customer support if you need clarification.', tone: 'text-ink-soft' }
  }
  const counts = rows.reduce((result, row) => {
    const group = statusInfo(row.status).group
    result[group] += 1
    return result
  }, { active: 0, completed: 0, not_approved: 0, other: 0 })
  const visibleRows = rows.filter((row) => {
    const group = statusInfo(row.status).group
    const matchesFilter = filter === 'all' || (filter === 'active' ? group === 'active' : filter === 'completed' ? group === 'completed' : group === 'not_approved')
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || [row.id, row.amount, row.currency, row.status, row.created_at, row.admin_note, row.payout_method]
      .some((value) => String(value ?? '').toLowerCase().includes(query))
    return matchesFilter && matchesSearch
  })
  return (
    <div className="border border-border bg-card">
      <div className="grid gap-3 border-b border-border px-6 py-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="display text-lg">{title}</h2>
          <span className="text-xs text-ink-soft">{rows.length} {rows.length === 1 ? 'request' : 'requests'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-background px-3 py-2"><p className="text-[0.6rem] text-ink-soft">Awaiting / active</p><p className="display mt-1 text-xl">{counts.active}</p></div>
          <div className="bg-background px-3 py-2"><p className="text-[0.6rem] text-ink-soft">Completed</p><p className="display mt-1 text-xl">{counts.completed}</p></div>
          <div className="bg-background px-3 py-2"><p className="text-[0.6rem] text-ink-soft">Not approved</p><p className="display mt-1 text-xl">{counts.not_approved}</p></div>
        </div>
        <label className="block"><span className="sr-only">Search {title.toLowerCase()}</span><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search amount, date, status or reference" className={fieldClass} /></label>
        <div className="flex flex-wrap gap-2" aria-label={`Filter ${title.toLowerCase()}`}>
          {(['all', 'active', 'completed', 'not_approved'] as const).map((value) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={`border px-3 py-2 text-xs transition-colors ${filter === value ? 'border-brass bg-brass/10 text-brass' : 'border-border text-ink-soft hover:border-brass'}`}>{value === 'all' ? `All (${rows.length})` : value === 'active' ? `Active (${counts.active})` : value === 'completed' ? `Completed (${counts.completed})` : `Not approved (${counts.not_approved})`}</button>)}
          <button type="button" onClick={() => { setSearch(''); setFilter('all') }} disabled={!search && filter === 'all'} className="border border-border px-3 py-2 text-xs text-ink-soft disabled:opacity-50">Clear</button>
        </div>
      </div>
      {rows.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No requests submitted yet.</p> : visibleRows.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No matching requests found.</p> : (
        <ul className="divide-y divide-border">
          {visibleRows.map((row) => {
            const info = statusInfo(row.status)
            return <li key={row.id} className="px-6 py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm">{date(row.created_at)}</p>
                  <p className={`eyebrow mt-2 text-[0.55rem] ${info.tone}`}>{info.label}</p>
                  <p className="mt-1 max-w-xl text-xs leading-5 text-ink-soft">{info.detail}</p>
                  <p className="mt-2 text-[0.6rem] text-ink-soft">Request reference: {row.id.slice(0, 8).toUpperCase()}</p>
                  {row.payout_method ? <p className="mt-1 text-xs text-ink-soft">Payout method: {row.payout_method}</p> : null}
                  {row.admin_note ? <p className="mt-2 border-l-2 border-brass/60 pl-3 text-xs leading-5 text-ink-soft">Administrator note: {row.admin_note}</p> : null}
                </div>
                <p className="display shrink-0 text-lg">{money(convertCurrency(row.amount, row.currency, displayCurrency, rates), displayCurrency)}</p>
              </div>
            </li>
          })}
        </ul>
      )}
      {rows.length > 0 ? <p className="border-t border-border px-6 py-3 text-xs text-ink-soft">Showing {visibleRows.length} of {rows.length} requests.</p> : null}
    </div>
  )
}

function CommissionHistory({ rows, displayCurrency, rates }: { rows: CommissionRow[]; displayCurrency: Currency; rates: FxRates }) {
  return (
    <div id="commissions" className="border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="display text-lg">Commission history</h2>
        <span className="text-xs text-ink-soft">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      {rows.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No commission records yet.</p> : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm capitalize">{row.commission_type.replace(/_/g, ' ')} commission</p>
                <p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {displayStatus(row.status)}</p>
                {row.description ? <p className="mt-2 text-xs text-ink-soft">{row.description}</p> : null}
              </div>
              <p className="display shrink-0 text-lg">{money(convertCurrency(row.amount, row.currency, displayCurrency, rates), displayCurrency)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function History({ title, rows, displayCurrency, rates }: { title: string; rows: ProfitRow[]; displayCurrency: Currency; rates: FxRates }) {
  return (
    <div className="border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <h2 className="display text-lg">{title}</h2>
        <span className="text-xs text-ink-soft">{rows.length} {rows.length === 1 ? 'record' : 'records'}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-ink-soft">No profit credits recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm">Profit payout</p>
                <p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {row.status.replace(/_/g, ' ')}</p>
              </div>
              <p className="display shrink-0 text-lg">{money(convertCurrency(row.amount, row.currency, displayCurrency, rates), displayCurrency)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
