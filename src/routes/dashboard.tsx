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
type LedgerItem = { id: string; amount: number | string; currency: Currency; transaction_type: string; direction: string; status: string; description: string | null; created_at: string }

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
  const [activity, setActivity] = useState<LedgerItem[]>([])
  const [unread, setUnread] = useState(0)
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
      const [profile, wallet, projects, ledger, notices] = await Promise.all([
        client.from('profiles').select('full_name,preferred_currency').eq('id', current.id).maybeSingle(),
        client.from('wallet_balances').select('balance').eq('user_id', current.id).eq('currency', currency).maybeSingle(),
        client.from('investments').select('id,amount,currency,status,created_at,reference,property_id').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('wallet_transactions').select('id,amount,currency,transaction_type,direction,status,description,created_at').eq('user_id', current.id).order('created_at', { ascending: false }).limit(8),
        client.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', current.id).is('read_at', null),
      ])
      for (const result of [profile, wallet, projects, ledger, notices]) if (result.error) throw result.error
      setName(profile.data?.full_name?.trim() || current.user_metadata?.full_name || current.email?.split('@')[0] || 'Member')
      const preferred = profile.data?.preferred_currency
      if (preferred && currencies.includes(preferred as Currency) && preferred !== currency) {
        setCurrency(preferred as Currency)
        return
      }
      setBalance(Number(wallet.data?.balance ?? 0))
      setInvestments((projects.data ?? []) as Investment[])
      setActivity((ledger.data ?? []) as LedgerItem[])
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

  const activeProjects = investments.filter((row) => ['approved', 'funded', 'completed'].includes(row.status)).length
  const pendingProjects = investments.filter((row) => row.status === 'pending').length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
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

            <section className="grid gap-6 lg:grid-cols-2">
              <div className="border border-border bg-card"><div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5"><h2 className="display text-xl">Your property requests</h2><Link to="/residences" className="eyebrow text-[0.5rem]">Explore projects <ArrowRight /></Link></div>
                {investments.length === 0 ? <div className="px-6 py-8"><p className="text-sm text-ink-soft">You have not submitted a property request yet.</p><Link to="/residences" className="eyebrow mt-4 inline-flex items-center gap-2 text-[0.55rem]">Browse properties <ArrowRight /></Link></div> : <ul className="divide-y divide-border">{investments.map((row) => <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4"><div><p className="text-sm">{row.reference || 'Property request'}</p><p className="mt-1 text-xs text-ink-soft">{formatDate(row.created_at)} · {formatMoney(row.amount, row.currency)}</p></div><span className="eyebrow text-[0.5rem] text-ink-soft">{row.status}</span></li>)}</ul>}
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
