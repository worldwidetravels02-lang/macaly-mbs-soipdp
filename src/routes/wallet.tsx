import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/wallet']
const currencies = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR'] as const
type Currency = (typeof currencies)[number]
type WalletRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; description?: string | null; transaction_type?: string; direction?: string }
type ProfitRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; admin_note?: string | null }
type RequestRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; admin_note?: string | null }
type WalletNotification = { id: string; title: string; body: string; read_at: string | null; created_at: string }

const fieldClass = 'mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60'

function money(value: number | string, currency: Currency) {
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
}
function date(value: string) {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
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
  const [currency, setCurrency] = useState<Currency>('AED')
  const [balance, setBalance] = useState(0)
  const [transactions, setTransactions] = useState<WalletRow[]>([])
  const [profits, setProfits] = useState<ProfitRow[]>([])
  const [topups, setTopups] = useState<RequestRow[]>([])
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([])
  const [notifications, setNotifications] = useState<WalletNotification[]>([])
  const [depositAmount, setDepositAmount] = useState('')
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [requestBusy, setRequestBusy] = useState(false)
  const [error, setError] = useState('')

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
      const [profileResult, balanceResult, transactionResult, profitResult, topupResult, withdrawalResult, notificationResult] = await Promise.all([
        client.from('profiles').select('preferred_currency').eq('id', authData.user.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', authData.user.id).eq('currency', currency).maybeSingle(),
        client.from('wallet_transactions').select('id,amount,currency,status,created_at,description,transaction_type,direction').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('profit_payouts').select('id,amount,currency,status,created_at,admin_note').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
        client.from('topup_requests').select('id,amount,currency,status,created_at,admin_note').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('withdrawal_requests').select('id,amount,currency,status,created_at,admin_note').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('notifications').select('id,title,body,read_at,created_at').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
      ])
      for (const result of [profileResult, balanceResult, transactionResult, profitResult, topupResult, withdrawalResult, notificationResult]) {
        if (result.error) throw result.error
      }
      const savedCurrency = profileResult.data?.preferred_currency
      if (savedCurrency && currencies.includes(savedCurrency as Currency) && savedCurrency !== currency) {
        setCurrency(savedCurrency as Currency)
        return
      }
      setBalance(Number(balanceResult.data?.balance ?? 0))
      setTransactions((transactionResult.data ?? []) as WalletRow[])
      setProfits((profitResult.data ?? []) as ProfitRow[])
      setTopups((topupResult.data ?? []) as RequestRow[])
      setWithdrawals((withdrawalResult.data ?? []) as RequestRow[])
      setNotifications((notificationResult.data ?? []) as WalletNotification[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your wallet.')
    } finally {
      setLoading(false)
    }
  }, [currency])

  useEffect(() => {
    void loadWallet()
    const client = requireSupabase()
    const { data: listener } = client.auth.onAuthStateChange(() => { void loadWallet() })
    return () => listener.subscription.unsubscribe()
  }, [loadWallet])

  async function submitWalletRequest(kind: 'deposit' | 'withdrawal') {
    const rawAmount = kind === 'deposit' ? depositAmount : withdrawalAmount
    const amount = Number(rawAmount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000000) { setError('Enter a valid amount.'); return }
    if (kind === 'withdrawal' && amount > balance) { setError('Your withdrawal request cannot exceed your available posted balance.'); return }
    setRequestBusy(true); setError('')
    try {
      const client = requireSupabase()
      const { data: authData, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!authData.user) throw new Error('Please sign in again.')
      const table = kind === 'deposit' ? 'topup_requests' : 'withdrawal_requests'
      const { error: insertError } = await client.from(table).insert({ user_id: authData.user.id, amount, currency, status: 'pending' })
      if (insertError) throw insertError
      if (kind === 'deposit') setDepositAmount(''); else setWithdrawalAmount('')
      await loadWallet()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not submit your request.') }
    finally { setRequestBusy(false) }
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
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 sm:px-8">
          <header className="flex flex-col gap-5 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-brass">Member account</p>
              <h1 className="display mt-3 text-[clamp(1.8rem,4vw,2.6rem)]">Your wallet</h1>
              <p className="mt-2 text-sm text-ink-soft">Read-only wallet balance and transaction history.</p>
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

          {userId && !loading ? <>
            <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="border border-brass/40 bg-brass/5 p-6">
                <p className="eyebrow text-[0.5rem] text-brass">Available posted balance</p>
                <p data-testid="wallet-balance" className="display mt-3 text-3xl">{money(balance, currency)}</p>
                <p className="mt-2 text-xs text-ink-soft">Calculated from posted ledger entries only.</p>
              </div>
              <div className="border border-border bg-card p-6">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Credited profit total</p>
                <p className="display mt-3 text-2xl">{money(profits.filter((row) => row.status === 'credited' && row.currency === currency).reduce((total, row) => total + (Number(row.amount) || 0), 0), currency)}</p>
                <p className="mt-2 text-xs text-ink-soft">Posted profit payout records in {currency}.</p>
              </div>
              <div className="border border-border bg-card p-6">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Profit credit records</p>
                <p className="display mt-3 text-2xl">{profits.filter((row) => row.status === 'credited' && row.currency === currency).length}</p>
                <p className="mt-2 text-xs text-ink-soft">Credited payout records in {currency}.</p>
              </div>
            </section>


            <section className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={(event) => { event.preventDefault(); void submitWalletRequest('deposit') }} className="grid gap-3 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Add funds</p><h2 className="display mt-2 text-xl">Deposit request</h2><p className="mt-2 text-xs leading-6 text-ink-soft">Enter the amount and submit a request. Then contact customer support for instructions. No payment is taken on this page.</p></div>
                <label className="text-xs text-ink-soft">Deposit amount ({currency})<input required type="number" min="0.01" max="100000000" step="0.01" className={fieldClass} value={depositAmount} onChange={(event) => setDepositAmount(event.target.value)} placeholder="Enter amount" /></label>
                <button disabled={requestBusy || !depositAmount} className="eyebrow inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.6rem] text-primary-foreground disabled:opacity-50">Submit deposit request <ArrowRight /></button>
                <Link to="/support" className="text-sm text-brass underline underline-offset-4">Contact customer support for deposit instructions</Link>
              </form>
              <form onSubmit={(event) => { event.preventDefault(); void submitWalletRequest('withdrawal') }} className="grid gap-3 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Withdraw funds</p><h2 className="display mt-2 text-xl">Withdrawal request</h2><p className="mt-2 text-xs leading-6 text-ink-soft">Choose the amount and submit. Your request stays pending until an administrator reviews it. Contact support if you need help.</p></div>
                <label className="text-xs text-ink-soft">Withdrawal amount ({currency})<input required type="number" min="0.01" max="100000000" step="0.01" className={fieldClass} value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} placeholder="Enter amount" /></label>
                <button disabled={requestBusy || !withdrawalAmount} className="eyebrow inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.6rem] text-primary-foreground disabled:opacity-50">Apply for withdrawal <ArrowRight /></button>
                <Link to="/support" className="text-sm text-brass underline underline-offset-4">Contact customer support</Link>
              </form>
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
            {notifications.length > 0 ? <section className="border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="display text-lg">Wallet notifications</h2>
                <span className="text-xs text-ink-soft">{notifications.filter((item) => !item.read_at).length} unread</span>
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
              <RequestHistory title="Deposit requests" rows={topups} />
              <RequestHistory title="Withdrawal requests" rows={withdrawals} />
            </section>
            <section className="grid gap-6 lg:grid-cols-2">
              <History title="Profit credits" rows={profits.filter((row) => row.currency === currency)} />
              <div className="border border-border bg-card">
                <h2 className="display border-b border-border px-6 py-4 text-lg">Wallet activity</h2>
                {transactions.filter((row) => row.currency === currency).length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No posted wallet activity yet.</p> : <><ul data-testid="wallet-transactions" className="divide-y divide-border">{transactions.filter((row) => row.currency === currency).map((row) => { const direction = row.direction?.toLowerCase(); const sign = direction === 'debit' ? '−' : direction === 'credit' ? '+' : ''; const amountTone = direction === 'debit' ? 'text-destructive' : direction === 'credit' ? 'text-emerald-700' : 'text-foreground'; return <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div className="min-w-0"><p className="truncate text-sm">{row.description || row.transaction_type?.replace(/_/g, ' ') || 'Wallet transaction'}</p><p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {row.status.replace(/_/g, ' ')}</p></div><p className={`display shrink-0 text-lg ${amountTone}`}>{sign}{money(row.amount, currency)}</p></li> })}</ul><p className="border-t border-border px-6 py-3 text-xs text-ink-soft">Showing up to the latest 30 wallet transactions.</p></>}
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




function RequestHistory({ title, rows }: { title: string; rows: RequestRow[] }) {
  return (
    <div className="border border-border bg-card">
      <h2 className="display border-b border-border px-6 py-4 text-lg">{title}</h2>
      {rows.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No requests submitted yet.</p> : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm">{date(row.created_at)}</p>
                <p className="mt-1 text-xs capitalize text-ink-soft">{row.status.replace(/_/g, ' ')}</p>
                {row.admin_note ? <p className="mt-2 text-xs text-ink-soft">{row.admin_note}</p> : null}
              </div>
              <p className="display shrink-0 text-lg">{money(row.amount, row.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function History({ title, rows }: { title: string; rows: ProfitRow[] }) {
  return (
    <div className="border border-border bg-card">
      <h2 className="display border-b border-border px-6 py-4 text-lg">{title}</h2>
      {rows.length === 0 ? (
        <p className="px-6 py-6 text-sm text-ink-soft">No profit credits recorded yet.</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-4">
              <div className="min-w-0">
                <p className="text-sm">Profit payout</p>
                <p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {row.status.replace(/_/g, ' ')}</p>
                {row.admin_note ? <p className="mt-2 text-xs text-ink-soft">{row.admin_note}</p> : null}
              </div>
              <p className="display shrink-0 text-lg">{money(row.amount, row.currency)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
