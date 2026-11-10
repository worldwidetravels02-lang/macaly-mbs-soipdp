import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { requireSupabase } from '../lib/supabase-client'

type Currency = 'AED' | 'OMR' | 'SAR' | 'KWD' | 'BHD' | 'QAR'
type OrderRow = { id: string; property_name: string; plan_code: string | null; amount: number | string; currency: Currency; status: string; created_at: string }
type CommissionRow = { id: string; amount: number | string; currency: Currency; commission_type: string; description: string | null; status: string; created_at: string }
type Tab = 'orders' | 'commission'
type Filter = 'all' | 'active' | 'completed'

const currencies: Currency[] = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR']
const normalize = (value: unknown) => String(value ?? '').trim().toLowerCase().replace(/[\\s-]+/g, '_')
const completedStatuses = ['completed', 'paid', 'credited', 'successful', 'succeeded', 'funded']
const activeStatuses = ['pending', 'submitted', 'under_review', 'approved', 'processing', 'in_progress', 'active']
function formatMoney(value: number | string, currency: Currency) {
  const amount = Number(value)
  return new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0)
}
function formatDate(value: string) {
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(time) : 'Date unavailable'
}
function statusLabel(value: string) {
  return normalize(value).replace(/_/g, ' ') || 'Status unavailable'
}

export const Route = createFileRoute('/orders')({
  head: () => ({ meta: [{ title: 'Orders & Commission | Msheireb Properties' }, { name: 'robots', content: 'noindex' }] }),
  component: OrdersPage,
})

function OrdersPage() {
  const [userId, setUserId] = useState<string | null>(null)
  const [name, setName] = useState('Member')
  const [currency, setCurrency] = useState<Currency>('AED')
  const [tab, setTab] = useState<Tab>('orders')
  const [filter, setFilter] = useState<Filter>('all')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [commissions, setCommissions] = useState<CommissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!auth.user) { setUserId(null); setOrders([]); setCommissions([]); return }
      setUserId(auth.user.id)
      setName(String(auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || 'Member'))
      const [profileResult, orderResult, commissionResult] = await Promise.all([
        client.from('profiles').select('preferred_currency').eq('id', auth.user.id).maybeSingle(),
        client.from('investment_requests').select('id,property_name,plan_code,amount,currency,status,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }),
        client.from('commission_records').select('id,amount,currency,commission_type,description,status,created_at').eq('user_id', auth.user.id).order('created_at', { ascending: false }),
      ])
      for (const [table, result] of [['profiles', profileResult], ['investment_requests', orderResult], ['commission_records', commissionResult]] as const) {
        if (result.error) throw new Error('Could not load ' + table + ': ' + result.error.message)
      }
      const savedCurrency = profileResult.data?.preferred_currency
      if (savedCurrency && currencies.includes(savedCurrency as Currency)) setCurrency(savedCurrency as Currency)
      setOrders((orderResult.data ?? []) as OrderRow[])
      setCommissions((commissionResult.data ?? []) as CommissionRow[])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your order history.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    void load()
    const client = requireSupabase()
    const { data: listener } = client.auth.onAuthStateChange(() => { void load() })
    return () => listener.subscription.unsubscribe()
  }, [load])

  async function changeCurrency(next: Currency) {
    setCurrency(next)
    if (userId) {
      const { error: saveError } = await requireSupabase().from('profiles').update({ preferred_currency: next }).eq('id', userId)
      if (saveError) setError('Currency could not be saved: ' + saveError.message)
    }
  }

  const rows = tab === 'orders'
    ? orders.map((row) => ({ id: row.id, date: row.created_at, group: row.plan_code || 'Junior (Trial)', project: row.property_name, type: 'Order', amount: row.amount, currency: row.currency, status: row.status }))
    : commissions.map((row) => ({ id: row.id, date: row.created_at, group: row.commission_type || 'Commission', project: row.description || 'Commission credit', type: 'Commission', amount: row.amount, currency: row.currency, status: row.status }))
  const visibleRows = rows.filter((row) => {
    if (filter === 'active') return activeStatuses.includes(normalize(row.status))
    if (filter === 'completed') return completedStatuses.includes(normalize(row.status))
    return true
  }).filter((row) => row.currency === currency)

  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#25231f]">
      <WorkspaceSidebar mode="member" />
      <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#e8e4dc] bg-white/95 px-5 pl-20 backdrop-blur lg:left-64 lg:px-7">
        <div className="text-xs text-[#777]"><span>Workspace</span><span className="mx-2">/</span><strong className="text-[#25231f]">Orders</strong></div>
        <div className="flex items-center gap-3 sm:gap-5">
          <label className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[#888]">CURRENCY
            <select aria-label="Currency" value={currency} onChange={(event) => void changeCurrency(event.target.value as Currency)} className="rounded-md border border-[#e6e1d8] bg-white px-3 py-2 text-xs font-semibold text-[#172238]">{currencies.map((item) => <option key={item}>{item}</option>)}</select>
          </label>
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-[#e8e4dc] bg-[#fbfaf8] px-2 py-1.5 text-xs text-[#172238]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2e9e7] font-semibold">{name.slice(0, 1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{name.split(' ')[0]}</strong><span className="text-[10px] text-[#888]">User</span></span></Link>
        </div>
      </header>
      <main className="pb-16 pt-[86px] lg:ml-64">
        <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="display text-3xl text-[#25231f]">Orders</h1>
            <div className="flex items-center gap-2">
              {(['all', 'active', 'completed'] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={filter === value ? 'rounded-lg bg-[#201f1d] px-3 py-2 text-xs font-medium capitalize text-white' : 'rounded-lg border border-[#e5e1da] bg-white px-3 py-2 text-xs capitalize text-[#555]'}>{value === 'all' ? 'All' : value === 'active' ? 'Active' : 'Completed'}</button>)}
            </div>
          </div>
          <section className="mt-8 overflow-hidden rounded-xl border border-[#e7e2db] bg-white shadow-sm">
            <div className="flex gap-1 bg-[#f7f5f3] p-2">
              <button type="button" onClick={() => setTab('orders')} className={tab === 'orders' ? 'rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-[#242321] shadow-sm' : 'rounded-lg px-5 py-2.5 text-xs text-[#777]'}>Orders</button>
              <button type="button" onClick={() => setTab('commission')} className={tab === 'commission' ? 'rounded-lg bg-white px-5 py-2.5 text-xs font-semibold text-[#242321] shadow-sm' : 'rounded-lg px-5 py-2.5 text-xs text-[#777]'}>Commission</button>
            </div>
            {error ? <p role="alert" className="mx-5 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {loading ? <p className="p-8 text-sm text-[#777]">Loading your {tab === 'orders' ? 'orders' : 'commissions'}…</p> : !userId ? <div className="p-8 text-sm text-[#777]">Please sign in to view your history. <Link to="/login" className="font-semibold text-[#806b3c] underline">Sign in</Link></div> : (
              <div className="overflow-x-auto px-5 pb-5 pt-7">
                <table className="w-full min-w-[700px] border-collapse text-left text-xs">
                  <thead><tr className="border-b border-[#e6e2dc] text-[9px] font-semibold uppercase tracking-[0.13em] text-[#9a9a96]"><th className="px-3 py-4">Date</th><th className="px-3 py-4">Group / Project</th><th className="px-3 py-4">Type</th><th className="px-3 py-4">Amount</th><th className="px-3 py-4">Status</th></tr></thead>
                  <tbody>
                    {visibleRows.map((row) => <tr key={row.id} className="border-b border-[#e8e5e0] last:border-0 hover:bg-[#fcfbf9]"><td className="whitespace-nowrap px-3 py-4 text-[#777]">{formatDate(row.date)}</td><td className="px-3 py-4 text-[#555]"><span className="block">{row.group}</span><span className="mt-0.5 block text-[#777]">{row.project}</span></td><td className="px-3 py-4 text-[#555]">{row.type}</td><td className="whitespace-nowrap px-3 py-4 font-medium text-[#34322f]">{formatMoney(row.amount, row.currency)}</td><td className="px-3 py-4"><span className="inline-flex rounded-full bg-[#f3ecea] px-3 py-1.5 text-[10px] font-semibold capitalize text-[#5d4b49]">{statusLabel(row.status)}</span></td></tr>)}
                    {!visibleRows.length ? <tr><td colSpan={5} className="px-3 py-12 text-center text-sm text-[#888]">No {tab === 'orders' ? 'orders' : 'commission records'} found for this currency and filter.</td></tr> : null}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="mt-4 text-[11px] text-[#999]">This history shows records saved to your Msheireb Properties account.</p>
        </div>
      </main>
    </div>
  )
}
