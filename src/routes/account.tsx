import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Wordmark } from '../components/site-chrome'

type Profile = { full_name: string | null; mobile: string | null; preferred_language: string; preferred_currency: string }
type Wallet = { balance: number; hold_balance: number }
type RequestRow = { id: string; request_type: 'deposit' | 'withdrawal'; amount: number; note: string | null; status: string; admin_note: string | null; created_at: string }

export const Route = createFileRoute('/account')({ component: AccountPage })

function AccountPage() {
  const navigate = useNavigate()
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile>({ full_name: '', mobile: '', preferred_language: 'en', preferred_currency: 'AED' })
  const [wallet, setWallet] = useState<Wallet>({ balance: 0, hold_balance: 0 })
  const [records, setRecords] = useState<RequestRow[]>([])
  const [filter, setFilter] = useState('All')
  const [panel, setPanel] = useState('Records')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      if (!supabase) { setError('Account service is not configured.'); setLoading(false); return }
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user) { void navigate({ to: '/login' }); return }
      const id = auth.user.id
      const [profileResult, walletResult, recordsResult] = await Promise.all([
        supabase.from('profiles').select('full_name,mobile,preferred_language,preferred_currency').eq('id', id).maybeSingle(),
        supabase.from('member_wallets').select('balance,hold_balance').eq('user_id', id).maybeSingle(),
        supabase.from('wallet_requests').select('id,request_type,amount,note,status,admin_note,created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(100),
      ])
      if (!active) return
      setUserId(id); setEmail(auth.user.email ?? '')
      if (profileResult.data) setProfile(profileResult.data as Profile)
      if (walletResult.error) setError(walletResult.error.message)
      else setWallet({ balance: Number(walletResult.data?.balance ?? 0), hold_balance: Number(walletResult.data?.hold_balance ?? 0) })
      if (recordsResult.error) setError(recordsResult.error.message)
      else setRecords((recordsResult.data ?? []) as RequestRow[])
      setLoading(false)
    }
    void load()
    return () => { active = false }
  }, [navigate])

  const money = (n: number) => new Intl.NumberFormat('en-AE', { style: 'currency', currency: 'AED', maximumFractionDigits: 2 }).format(n)
  const filteredRecords = useMemo(() => records.filter(r => filter === 'All' || (filter === 'Cash in' && r.request_type === 'deposit') || (filter === 'Cash out' && r.request_type === 'withdrawal')), [records, filter])
  const shortId = userId ? (userId.replace(/[^0-9]/g, '').slice(-6) || userId.slice(0, 6)).padStart(4, '0') : '----'

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || !userId) return
    setSaving(true); setError(''); setNotice('')
    const { error: saveError } = await supabase.from('profiles').upsert({ id: userId, ...profile, updated_at: new Date().toISOString() }, { onConflict: 'id' })
    if (saveError) setError(saveError.message)
    else { setNotice('Your account details have been updated.'); setEditing(false) }
    setSaving(false)
  }

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supabase || newPassword.length < 8) { setError('Use a password with at least 8 characters.'); return }
    setSaving(true); setError(''); setNotice('')
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    if (updateError) setError(updateError.message)
    else { setNewPassword(''); setNotice('Your password has been changed.') }
    setSaving(false)
  }

  const signOut = async () => { if (!supabase) return; await supabase.auth.signOut(); await navigate({ to: '/login' }) }

  const sidebarItems = [
    { label: 'Records', icon: '☷' }, { label: 'Cash in', icon: '+' }, { label: 'Cash out', icon: '▱' },
    { label: 'Bind wallet', icon: '▣' }, { label: 'Change password', icon: '♙' }, { label: 'Withdrawal password', icon: '♧' }, { label: 'About deposit', icon: '▤' },
  ]

  return (
    <div className="min-h-screen bg-[#f7f6f4] text-[#1c1b19]">
      <header className="sticky top-0 z-30 flex h-[76px] items-center justify-between border-b border-[#e8e5df] bg-white px-4 sm:px-7">
        <div className="flex items-center gap-5"><Link to="/"><Wordmark /></Link><span className="hidden h-9 border-l border-[#e8e5df] sm:block" /><button type="button" onClick={() => setPanel(panel === 'Menu' ? 'Records' : 'Menu')} className="rounded-xl border border-[#e8e5df] px-4 py-2 lg:hidden" aria-label="Toggle account menu">☰</button><p className="hidden text-sm text-[#898783] sm:block">Workspace <span className="mx-2">/</span><strong className="text-[#1c1b19]">Account</strong></p></div>
        <div className="flex items-center gap-3 sm:gap-5"><label className="hidden items-center gap-3 sm:flex"><span className="text-[10px] font-bold tracking-widest text-[#898783]">CURRENCY</span><select value={profile.preferred_currency} onChange={e=>setProfile(p=>({...p,preferred_currency:e.target.value}))} className="rounded-lg border border-[#e8e5df] bg-white px-3 py-2.5 text-sm">{['AED','OMR','SAR','KWD','BHD','QAR'].map(v=><option key={v}>{v}</option>)}</select></label><div className="flex items-center gap-2 rounded-xl border border-[#e8e5df] bg-[#faf9f7] p-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f2eae8] font-bold text-[#9a804b]">{(profile.full_name?.[0] || email[0] || 'M').toUpperCase()}</span><span className="hidden pr-2 sm:block"><strong className="block max-w-28 truncate text-sm">{profile.full_name || 'Member'}</strong><small className="text-xs text-[#898783]">User</small></span></div></div>
      </header>
      <div className="flex min-h-[calc(100vh-76px)]">
        <aside className={`${panel === 'Menu' ? 'block' : 'hidden'} fixed inset-y-[76px] left-0 z-20 w-64 border-r border-[#e8e5df] bg-white px-3 py-7 lg:static lg:block lg:w-[268px]`}>
          <p className="mb-5 px-3 text-[10px] font-bold tracking-[0.2em] text-[#aaa59b]">WORKSPACE</p>
          <nav className="space-y-1">
            <Link to="/dashboard" className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm text-[#777] hover:bg-[#f7f5f2]">⌂ <span>Dashboard</span></Link>
            <Link to="/residences" className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm text-[#777] hover:bg-[#f7f5f2]">▦ <span>Projects</span></Link>
            <Link to="/wallet" className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm text-[#777] hover:bg-[#f7f5f2]">◷ <span>Orders & wallet</span></Link>
            <button type="button" onClick={()=>setPanel('Records')} className="flex w-full items-center gap-4 rounded-lg bg-[#f4f1ef] px-4 py-3 text-left text-sm font-semibold">♙ <span>Account</span></button>
            <Link to="/support" className="flex items-center gap-4 rounded-lg px-4 py-3 text-sm text-[#777] hover:bg-[#f7f5f2]">♧ <span>Support</span></Link>
          </nav>
          <div className="mt-12 border-t border-[#eee] pt-5"><button type="button" onClick={signOut} className="flex w-full items-center gap-4 px-4 py-3 text-sm text-[#777]">↪ <span>Log out</span></button></div>
        </aside>
        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {loading ? <div className="rounded-xl bg-white p-10 text-center text-sm text-[#777]">Loading account…</div> : <>
            {error ? <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
            {notice ? <p role="status" className="mb-4 rounded-lg border border-[#e2d5b5] bg-[#fbf7ed] p-3 text-sm">{notice}</p> : null}
            <section className="grid gap-4 rounded-xl border border-[#e7e3de] bg-white p-5 shadow-sm lg:grid-cols-[1.15fr_1fr] lg:p-6">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-white bg-[#f4efed] text-3xl font-bold shadow-[0_8px_25px_rgba(0,0,0,.08)]">{(profile.full_name?.[0] || email[0] || 'M').toUpperCase()}</div>
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-bold">{profile.full_name || 'Member'}</h1><span className="rounded-full bg-[#f3ece9] px-3 py-1 text-[10px] font-semibold">Active</span></div><p className="mt-2 text-sm text-[#898783]">User ID · {shortId}</p><p className="text-sm text-[#898783]">Mobile · {profile.mobile || 'Not added'}</p></div>
                <button type="button" onClick={()=>{setEditing(v=>!v);setPanel('Profile')}} aria-label="Edit profile" className="ml-auto self-start rounded-lg border border-[#e7e3de] p-3 hover:border-[#b89b59]">✎</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-[#f7f5f3] p-4"><strong className="text-lg">{records.length}</strong><p className="mt-1 text-xs text-[#898783]">Wallet requests</p></div>
                <div className="rounded-xl bg-[#f7f5f3] p-4"><strong className="text-lg">{records.filter(r=>r.status==='pending').length}</strong><p className="mt-1 text-xs text-[#898783]">Pending requests</p></div>
                <div className="rounded-xl bg-[#f7f5f3] p-4"><strong className="text-lg">{money(wallet.hold_balance)}</strong><p className="mt-1 text-xs text-[#898783]">On hold</p></div>
                <div className="rounded-xl bg-[#f7f5f3] p-4"><strong className="text-lg">{email ? 'Verified login' : 'Member'}</strong><p className="mt-1 text-xs text-[#898783]">Account status</p></div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:col-span-2"><div className="flex items-center justify-between rounded-xl bg-[#1e1b18] px-5 py-4 text-white"><span className="text-sm text-white/80">Wallet balance</span><strong>{money(wallet.balance)}</strong></div><div className="flex items-center justify-between rounded-xl bg-[#f5ebd1] px-5 py-4 text-[#4c412b]"><span className="text-sm">Hold balance</span><strong>{money(wallet.hold_balance)}</strong></div></div>
            </section>

            {editing || panel === 'Profile' ? <form onSubmit={saveProfile} className="mt-4 rounded-xl border border-[#e7e3de] bg-white p-5"><h2 className="text-xl font-semibold">Edit account</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="text-sm">Full name<input value={profile.full_name ?? ''} onChange={e=>setProfile(p=>({...p,full_name:e.target.value}))} className="mt-2 w-full rounded-lg border border-[#e7e3de] px-3 py-3" /></label><label className="text-sm">Mobile<input value={profile.mobile ?? ''} onChange={e=>setProfile(p=>({...p,mobile:e.target.value}))} className="mt-2 w-full rounded-lg border border-[#e7e3de] px-3 py-3" /></label><label className="text-sm">Language<select value={profile.preferred_language} onChange={e=>setProfile(p=>({...p,preferred_language:e.target.value}))} className="mt-2 w-full rounded-lg border border-[#e7e3de] px-3 py-3"><option value="en">English</option><option value="ar">Arabic</option></select></label><label className="text-sm">Currency<select value={profile.preferred_currency} onChange={e=>setProfile(p=>({...p,preferred_currency:e.target.value}))} className="mt-2 w-full rounded-lg border border-[#e7e3de] px-3 py-3">{['AED','OMR','SAR','KWD','BHD','QAR'].map(v=><option key={v}>{v}</option>)}</select></label></div><div className="mt-4 flex gap-2"><button disabled={saving} className="rounded-lg bg-[#1c1b19] px-5 py-3 text-sm text-white">{saving?'Saving…':'Save account'}</button><button type="button" onClick={()=>{setEditing(false);setPanel('Records')}} className="rounded-lg border border-[#e7e3de] px-5 py-3 text-sm">Cancel</button></div></form> : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-[294px_minmax(0,1fr)]">
              <nav className="overflow-hidden rounded-xl border border-[#e7e3de] bg-white">
                {sidebarItems.map(item=><button key={item.label} type="button" onClick={()=>{setPanel(item.label);if(item.label==='Cash in'||item.label==='Cash out') void navigate({to:'/wallet'})}} className={`flex w-full items-center justify-between border-b border-[#eee] px-5 py-4 text-left text-sm transition hover:bg-[#faf9f7] ${panel===item.label?'bg-[#faf8f5] font-semibold':''}`}><span className="flex items-center gap-4"><span className="w-4 text-base">{item.icon}</span>{item.label}</span><span className="text-lg text-[#999]">›</span></button>)}
              </nav>
              <section className="min-w-0 overflow-hidden rounded-xl border border-[#e7e3de] bg-white p-5 sm:p-6">
                <h2 className="display text-3xl">{panel === 'Change password' ? 'Change password' : panel === 'Withdrawal password' ? 'Withdrawal password' : panel === 'About deposit' ? 'About deposit' : panel === 'Bind wallet' ? 'Bind wallet' : 'Records'}</h2>
                {panel === 'Change password' ? <form onSubmit={changePassword} className="mt-5 max-w-md"><label className="block text-sm">New password<input type="password" minLength={8} required value={newPassword} onChange={e=>setNewPassword(e.target.value)} className="mt-2 w-full rounded-lg border border-[#e7e3de] px-4 py-3" placeholder="At least 8 characters" /></label><button disabled={saving} className="mt-4 rounded-lg bg-[#1c1b19] px-5 py-3 text-sm text-white">{saving?'Saving…':'Update password'}</button></form>
                : panel === 'Withdrawal password' ? <p className="mt-5 text-sm leading-7 text-[#777]">A separate withdrawal PIN is not configured yet. Your account password protects sign-in; withdrawal requests remain subject to administrator review.</p>
                : panel === 'Bind wallet' ? <p className="mt-5 text-sm leading-7 text-[#777]">Wallet funding is handled through the official customer support channel. No bank or card details are stored on this page. <Link to="/support" className="font-semibold text-[#927843] underline">Contact support</Link>.</p>
                : panel === 'About deposit' ? <p className="mt-5 text-sm leading-7 text-[#777]">To add funds, submit a deposit request from My wallet, then contact customer support for verified instructions. Your balance is updated only after an administrator approves the request. <Link to="/wallet" className="font-semibold text-[#927843] underline">Open My wallet</Link>.</p>
                : <><div className="mt-5 flex flex-wrap gap-2">{['All','Cash in','Cash out'].map(v=><button key={v} type="button" onClick={()=>setFilter(v)} className={`rounded-lg border px-4 py-2 text-xs font-semibold ${filter===v?'border-[#1c1b19] bg-[#1c1b19] text-white':'border-[#e7e3de] text-[#777]'}`}>{v}</button>)}</div>
                  <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead><tr className="border-b border-[#e7e3de] text-[10px] uppercase tracking-wider text-[#9a9994]"><th className="px-3 py-4">Reference</th><th className="px-3 py-4">Type</th><th className="px-3 py-4">Description</th><th className="px-3 py-4">Amount</th><th className="px-3 py-4">Status</th><th className="px-3 py-4">Date</th></tr></thead><tbody>{filteredRecords.map(row=><tr key={row.id} className="border-b border-[#eee]"><td className="px-3 py-4 font-mono text-[#777]">{row.id.slice(0,12)}</td><td className="px-3 py-4 capitalize">{row.request_type==='deposit'?'Cash in':'Cash out'}</td><td className="px-3 py-4">{row.note || 'Wallet request'}</td><td className="px-3 py-4 font-semibold">{row.request_type==='deposit'?'+':'−'}{money(Number(row.amount))}</td><td className="px-3 py-4"><span className="rounded-full bg-[#f2eeea] px-3 py-1 capitalize">{row.status}</span></td><td className="px-3 py-4 text-[#777]">{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{filteredRecords.length===0?<p className="py-8 text-center text-sm text-[#888]">No records yet.</p>:null}</div>
                </>}
              </section>
            </div>
          </>}
        </main>
      </div>
    </div>
  )
}
