import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/wallet']
const currencies = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR'] as const
type Currency = (typeof currencies)[number]
type WalletRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; description?: string | null; transaction_type?: string; direction?: string }
type RequestRow = { id: string; amount: number | string; currency: Currency; status: string; created_at: string; admin_note?: string | null; payment_method?: string | null; payout_method?: string | null }

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
  const [topups, setTopups] = useState<RequestRow[]>([])
  const [withdrawals, setWithdrawals] = useState<RequestRow[]>([])
  const [profits, setProfits] = useState<RequestRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [topup, setTopup] = useState({ amount: '', method: 'Bank transfer', reference: '' })
  const [withdrawal, setWithdrawal] = useState({ amount: '', method: 'Bank transfer', details: '' })
  const [sending, setSending] = useState(false)

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
      const [profileResult, balanceResult, transactionResult, topupResult, withdrawalResult, profitResult] = await Promise.all([
        client.from('profiles').select('preferred_currency').eq('id', authData.user.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', authData.user.id).eq('currency', currency).maybeSingle(),
        client.from('wallet_transactions').select('id,amount,currency,status,created_at,description,transaction_type,direction').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('topup_requests').select('id,amount,currency,status,created_at,admin_note,payment_method').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
        client.from('withdrawal_requests').select('id,amount,currency,status,created_at,admin_note,payout_method').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
        client.from('profit_payouts').select('id,amount,currency,status,created_at').eq('user_id', authData.user.id).order('created_at', { ascending: false }).limit(20),
      ])
      for (const result of [profileResult, balanceResult, transactionResult, topupResult, withdrawalResult, profitResult]) {
        if (result.error) throw result.error
      }
      const savedCurrency = profileResult.data?.preferred_currency
      if (savedCurrency && currencies.includes(savedCurrency as Currency) && savedCurrency !== currency) {
        setCurrency(savedCurrency as Currency)
        return
      }
      setBalance(Number(balanceResult.data?.balance ?? 0))
      setTransactions((transactionResult.data ?? []) as WalletRow[])
      setTopups((topupResult.data ?? []) as RequestRow[])
      setWithdrawals((withdrawalResult.data ?? []) as RequestRow[])
      setProfits((profitResult.data ?? []) as RequestRow[])
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

  async function submitTopup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const amount = Number(topup.amount)
    if (!userId || !Number.isFinite(amount) || amount <= 0) return setError('Enter a valid amount greater than zero.')
    setSending(true)
    try {
      const { error: insertError } = await requireSupabase().from('topup_requests').insert({
        user_id: userId, amount, currency, payment_method: topup.method,
        payment_reference: topup.reference.trim() || null, status: 'pending',
      })
      if (insertError) throw insertError
      setTopup({ amount: '', method: topup.method, reference: '' })
      setNotice('Your top-up request was submitted for administrator review. Your wallet balance has not changed.')
      await loadWallet()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your top-up request.')
    } finally { setSending(false) }
  }

  async function submitWithdrawal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')
    const amount = Number(withdrawal.amount)
    if (!userId || !Number.isFinite(amount) || amount <= 0) return setError('Enter a valid amount greater than zero.')
    if (amount > balance) return setError('The requested amount is higher than your available posted wallet balance.')
    if (!withdrawal.details.trim()) return setError('Enter the payout details needed for administrator review.')
    setSending(true)
    try {
      const { error: insertError } = await requireSupabase().from('withdrawal_requests').insert({
        user_id: userId, amount, currency, payout_method: withdrawal.method,
        payout_details: { instructions: withdrawal.details.trim() }, status: 'pending',
      })
      if (insertError) throw insertError
      setWithdrawal({ amount: '', method: withdrawal.method, details: '' })
      setNotice('Your withdrawal request was submitted for review. This is not a bank transfer or payout confirmation.')
      await loadWallet()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your withdrawal request.')
    } finally { setSending(false) }
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
              <p className="mt-2 text-sm text-ink-soft">Secure wallet records and payment requests.</p>
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
          {notice ? <p role="status" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft">{notice}</p> : null}

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
              <div className="border border-border bg-card p-6">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Pending requests</p>
                <p className="display mt-3 text-2xl">{topups.filter((row) => row.currency === currency && row.status === 'pending').length + withdrawals.filter((row) => row.currency === currency && row.status === 'pending').length}</p>
                <p className="mt-2 text-xs text-ink-soft">Top-ups and withdrawals awaiting review in {currency}.</p>
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={submitTopup} className="grid gap-4 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Add funds</p><h2 className="display mt-2 text-2xl">Request a top-up</h2><p className="mt-2 text-sm text-ink-soft">A top-up is credited only after an administrator verifies and approves it.</p></div>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Amount ({currency})</span><input className={fieldClass} type="number" min="0.01" step="0.01" required value={topup.amount} onChange={(event) => setTopup({ ...topup, amount: event.target.value })} /></label>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Payment method</span><select className={fieldClass} value={topup.method} onChange={(event) => setTopup({ ...topup, method: event.target.value })}><option>Bank transfer</option><option>Card payment</option><option>Other</option></select></label>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Payment reference (optional)</span><input className={fieldClass} value={topup.reference} onChange={(event) => setTopup({ ...topup, reference: event.target.value })} /></label>
                <button disabled={sending} className="eyebrow justify-self-start bg-primary px-6 py-4 text-[0.58rem] text-primary-foreground disabled:opacity-50">{sending ? 'Submitting…' : 'Submit top-up request'}</button>
              </form>

              <form onSubmit={submitWithdrawal} className="grid gap-4 border border-border bg-card p-6">
                <div><p className="eyebrow text-brass">Withdraw funds</p><h2 className="display mt-2 text-2xl">Request a withdrawal</h2><p className="mt-2 text-sm text-ink-soft">Requests are reviewed by administration. Approval does not mean money has been transferred.</p></div>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Amount ({currency})</span><input className={fieldClass} type="number" min="0.01" step="0.01" max={balance} required value={withdrawal.amount} onChange={(event) => setWithdrawal({ ...withdrawal, amount: event.target.value })} /></label>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Payout method</span><select className={fieldClass} value={withdrawal.method} onChange={(event) => setWithdrawal({ ...withdrawal, method: event.target.value })}><option>Bank transfer</option><option>Other</option></select></label>
                <label className="block"><span className="eyebrow text-[0.5rem] text-ink-soft">Payout details</span><textarea className={fieldClass} rows={3} required value={withdrawal.details} onChange={(event) => setWithdrawal({ ...withdrawal, details: event.target.value })} placeholder="Enter the details administration needs to review your request." /></label>
                <button disabled={sending || balance <= 0} className="eyebrow justify-self-start bg-primary px-6 py-4 text-[0.58rem] text-primary-foreground disabled:opacity-50">{sending ? 'Submitting…' : 'Submit withdrawal request'}</button>
              </form>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <History title="Top-up requests" rows={topups.filter((row) => row.currency === currency)} />
              <History title="Withdrawal requests" rows={withdrawals.filter((row) => row.currency === currency)} />
              <History title="Profit credits" rows={profits.filter((row) => row.currency === currency)} />
              <div className="border border-border bg-card">
                <h2 className="display border-b border-border px-6 py-4 text-lg">Wallet activity</h2>
                {transactions.filter((row) => row.currency === currency).length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No posted wallet activity yet.</p> : <ul data-testid="wallet-transactions" className="divide-y divide-border">{transactions.filter((row) => row.currency === currency).map((row) => <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm">{row.description || row.transaction_type || 'Wallet transaction'}</p><p className="mt-1 text-xs text-ink-soft">{date(row.created_at)} · {row.status}</p></div><p className="display text-lg">{row.direction === 'debit' ? '−' : '+'}{money(row.amount, currency)}</p></li>)}</ul>}
              </div>
            </section>
            <p className="text-xs leading-relaxed text-ink-soft">Wallet entries and profit credits shown here are internal platform records. They are not proof of a bank transfer, regulated investment return, or external payment settlement. Crypto payments and identity-document review are not enabled on this Supabase wallet screen yet.</p>
          </> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function History({ title, rows }: { title: string; rows: RequestRow[] }) {
  return <section className="border border-border bg-card"><h2 className="display border-b border-border px-6 py-4 text-lg">{title}</h2>{rows.length === 0 ? <p className="px-6 py-6 text-sm text-ink-soft">No records yet.</p> : <ul className="divide-y divide-border">{rows.map((row) => <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm">{money(row.amount, row.currency)}</p><p className="mt-1 text-xs text-ink-soft">{date(row.created_at)}{row.payment_method || row.payout_method ? ` · ${row.payment_method || row.payout_method}` : ''}{row.admin_note ? ` · ${row.admin_note}` : ''}</p></div><span className="eyebrow text-[0.5rem] text-ink-soft">{row.status}</span></li>)}</ul>}</section>
}
