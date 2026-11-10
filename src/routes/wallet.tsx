import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

type Wallet = { balance: number; hold_balance: number }
type WalletRequest = {
  id: string
  request_type: 'deposit' | 'withdrawal'
  amount: number
  note: string | null
  status: 'pending' | 'approved' | 'rejected'
  admin_note: string | null
  created_at: string
}

export const Route = createFileRoute('/wallet')({ component: WalletPage })

function WalletPage() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, hold_balance: 0 })
  const [requests, setRequests] = useState<WalletRequest[]>([])
  const [requestType, setRequestType] = useState<'deposit' | 'withdrawal'>('deposit')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loadWallet = useCallback(async () => {
    if (!supabase) { setError('Wallet services are not configured.'); setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setLoading(false); void navigate({ to: '/login' }); return }
    const [{ data: walletData, error: walletError }, { data: requestData, error: requestError }] = await Promise.all([
      supabase.from('member_wallets').select('balance,hold_balance').eq('user_id', auth.user.id).maybeSingle(),
      supabase.from('wallet_requests').select('id,request_type,amount,note,status,admin_note,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }).limit(30),
    ])
    if (walletError) setError(walletError.message)
    else setWallet({ balance: Number(walletData?.balance ?? 0), hold_balance: Number(walletData?.hold_balance ?? 0) })
    if (requestError) setError(requestError.message)
    else setRequests((requestData ?? []) as WalletRequest[])
    setLoading(false)
  }, [navigate])

  useEffect(() => { void loadWallet() }, [loadWallet])

  const money = (value: number) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 2 }).format(value)
  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase) return
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { void navigate({ to: '/login' }); return }
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) { setError('Enter an amount greater than zero.'); return }
    if (requestType === 'withdrawal' && value > wallet.balance) { setError('The requested withdrawal is higher than your available wallet balance.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: insertError } = await supabase.from('wallet_requests').insert({
      user_id: auth.user.id,
      request_type: requestType, amount: value, note: note.trim() || null, status: 'pending',
    })
    if (insertError) setError(insertError.message)
    else {
      setAmount(''); setNote('')
      setNotice(requestType === 'deposit'
        ? 'Deposit request sent. Contact customer support for official payment instructions. Your wallet changes only after admin approval.'
        : 'Withdrawal request submitted. It will remain pending until an administrator reviews it.')
      await loadWallet()
    }
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl px-5 pb-20 pt-32 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-7">
          <div><p className="eyebrow text-brass">Private member area</p><h1 className="display mt-3 text-4xl">My wallet</h1><p className="mt-3 text-sm text-ink-soft">View your balance and submit a request for administrator review.</p></div>
          <Link to="/dashboard" className="eyebrow border border-border px-5 py-3">Back to dashboard</Link>
        </div>
        {error ? <p role="alert" className="mt-6 border border-destructive/40 px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {notice ? <p role="status" className="mt-6 border border-brass/40 bg-brass/5 px-4 py-3 text-sm leading-relaxed">{notice}</p> : null}
        {loading ? <p className="py-12 text-sm text-ink-soft">Loading your wallet…</p> : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2">
              <article className="border border-brass/50 bg-primary p-7 text-primary-foreground"><p className="eyebrow text-[0.6rem] text-primary-foreground/70">Available wallet balance</p><p className="display mt-4 text-3xl sm:text-4xl">{money(wallet.balance)}</p><p className="mt-3 text-xs text-primary-foreground/70">Balance changes are controlled by administrator approval.</p></article>
              <article className="border border-border bg-card p-7"><p className="eyebrow text-[0.6rem] text-ink-soft">Hold balance</p><p className="display mt-4 text-3xl sm:text-4xl">{money(wallet.hold_balance)}</p><p className="mt-3 text-xs text-ink-soft">Funds currently held by the platform, if applicable.</p></article>
            </section>
            <section className="mt-10 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
              <form onSubmit={submitRequest} className="h-fit border border-border bg-card p-6 sm:p-7">
                <p className="eyebrow text-brass">Wallet service</p><h2 className="display mt-2 text-2xl">New request</h2>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setRequestType('deposit')} aria-pressed={requestType==='deposit'} className={requestType==='deposit'?'border border-brass bg-brass/10 px-3 py-3 text-sm':'border border-border px-3 py-3 text-sm'}>Deposit request</button>
                  <button type="button" onClick={() => setRequestType('withdrawal')} aria-pressed={requestType==='withdrawal'} className={requestType==='withdrawal'?'border border-brass bg-brass/10 px-3 py-3 text-sm':'border border-border px-3 py-3 text-sm'}>Withdrawal request</button>
                </div>
                <label className="mt-5 block text-sm">Amount (AED)<input required type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)} className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none focus:border-brass" placeholder="Enter amount" /></label>
                <label className="mt-4 block text-sm">Note (optional)<textarea value={note} onChange={e=>setNote(e.target.value)} rows={3} maxLength={500} className="mt-2 w-full border border-input bg-background px-4 py-3 outline-none focus:border-brass" placeholder={requestType==='deposit'?'Add a note for the support team':'Add withdrawal instructions'} /></label>
                <p className="mt-4 text-xs leading-relaxed text-ink-soft">{requestType==='deposit'?'Submit the request first, then contact support for official payment details. Do not send money to unverified accounts.':'Your request does not transfer money immediately. The administrator must approve it before your balance changes.'}</p>
                <button disabled={busy} className="eyebrow mt-5 w-full bg-primary px-5 py-4 text-primary-foreground disabled:opacity-60">{busy?'Submitting…':('Submit '+requestType+' request')}</button>
              </form>
              <section><p className="eyebrow text-brass">Request history</p><h2 className="display mt-2 text-2xl">Your requests</h2>
                <div className="mt-5 divide-y divide-border border-y border-border">
                  {requests.length ? requests.map(item=>(
                    <article key={item.id} className="py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium capitalize">{item.request_type} · {money(Number(item.amount))}</p><p className="mt-1 text-xs text-ink-soft">{new Date(item.created_at).toLocaleString()}</p></div><span className={item.status==='approved'?'border border-green-700/30 bg-green-700/10 px-3 py-1 text-xs text-green-800':item.status==='rejected'?'border border-destructive/30 bg-destructive/5 px-3 py-1 text-xs text-destructive':'border border-brass/40 bg-brass/10 px-3 py-1 text-xs'}>{item.status}</span></div>
                      {item.note ? <p className="mt-2 text-sm text-ink-soft">{item.note}</p>:null}{item.admin_note ? <p className="mt-2 text-sm">Admin note: {item.admin_note}</p>:null}
                    </article>
                  )) : <p className="py-6 text-sm text-ink-soft">You have not submitted any wallet requests yet.</p>}
                </div>
              </section>
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
