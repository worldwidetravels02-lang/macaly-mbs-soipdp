import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase-client'

type Currency = 'AED' | 'OMR' | 'SAR' | 'KWD' | 'BHD' | 'QAR'
type Section = 'records' | 'cashin' | 'cashout' | 'bank' | 'bindForm' | 'password' | 'withdrawalPassword' | 'deposit' | 'terms'
type BankAccount = { id: string; account_holder: string; bank_name: string; iban: string; account_number: string; mobile_number: string; created_at: string }
type RecordRow = { id: string; type: string; description: string; amount: number; currency: Currency; status: string; created_at: string }
const currencies: Currency[] = ['OMR','AED','SAR','KWD','BHD','QAR']
type FxRates = Record<Currency, number>
const fallbackFxRates: FxRates = { OMR: 1, AED: 9.55, SAR: 9.7549, KWD: 0.7978, BHD: 0.9805, QAR: 9.4836 }
function convertCurrency(value: number | string, from: Currency, to: Currency, rates: FxRates) { const amount = Number(value); if (!Number.isFinite(amount)) return 0; if (from === to) return amount; return rates[from] > 0 && rates[to] > 0 ? amount / rates[from] * rates[to] : amount }
const menu: {id: Section; label: string; icon: string}[] = [
  {id:'records',label:'Records',icon:'☷'},{id:'cashin',label:'Cash in',icon:'＋'},
  {id:'cashout',label:'Cash out',icon:'▱'},{id:'bank',label:'Bind wallet',icon:'▣'},
  {id:'password',label:'Change password',icon:'♙'},{id:'withdrawalPassword',label:'Withdrawal password',icon:'♧'},
  {id:'deposit',label:'About deposit',icon:'▤'},{id:'terms',label:'Terms & conditions',icon:'☷'},
]
const field = 'w-full rounded-md border border-[#e5e1dc] bg-white px-4 py-3 text-sm text-[#292722] outline-none focus:border-[#b89b59]'
const button = 'rounded-md bg-[#201d1b] px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50'
const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[ _-]+/g,' ').trim()
const money = (v: number, c: Currency) => new Intl.NumberFormat('en',{style:'currency',currency:c,maximumFractionDigits:2}).format(Number.isFinite(v)?v:0)
const fmtDate = (v: string) => new Intl.DateTimeFormat('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(v))
export const Route = createFileRoute('/account')({ component: AccountPage })

function AccountPage() {
  const navigate = useNavigate()
  const [userId,setUserId] = useState('')
  const [name,setName] = useState('Member')
  const [mobile,setMobile] = useState('')
  const [email,setEmail] = useState('')
  const [currency,setCurrency] = useState<Currency>('OMR')
  const [fxRates,setFxRates] = useState<FxRates>(fallbackFxRates)
  const [fxDate,setFxDate] = useState('')
  const [fxError,setFxError] = useState('')
  const [section,setSection] = useState<Section>('records')
  const [records,setRecords] = useState<RecordRow[]>([])
  const [banks,setBanks] = useState<BankAccount[]>([])
  const [balance,setBalance] = useState(0)
  const [hold,setHold] = useState(0)
  const [projects,setProjects] = useState(0)
  const [trialBonus,setTrialBonus] = useState(0)
  const [todayRevenue,setTodayRevenue] = useState(0)
  const [totalCommission,setTotalCommission] = useState(0)
  const [filter,setFilter] = useState('All')
  const [loading,setLoading] = useState(true)
  const [busy,setBusy] = useState(false)
  const [notice,setNotice] = useState('')
  const [error,setError] = useState('')
  const [amount,setAmount] = useState('500')
  const [bankId,setBankId] = useState('')
  const [withdrawalCode,setWithdrawalCode] = useState('')
  const [hasWithdrawalCode,setHasWithdrawalCode] = useState(false)
  const [accountHolder,setAccountHolder] = useState('')
  const [bankName,setBankName] = useState('')
  const [iban,setIban] = useState('')
  const [accountNumber,setAccountNumber] = useState('')
  const [bankMobile,setBankMobile] = useState('')
  const [currentPassword,setCurrentPassword] = useState('')
  const [newPassword,setNewPassword] = useState('')
  const [confirmPassword,setConfirmPassword] = useState('')
  const [newWithdrawalCode,setNewWithdrawalCode] = useState('')
  const [confirmWithdrawalCode,setConfirmWithdrawalCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const db = requireSupabase()
      const {data:auth,error:authError} = await db.auth.getUser()
      if(authError) throw authError
      if(!auth.user){setUserId('');return}
      const id=auth.user.id
      setUserId(id); setEmail(auth.user.email ?? '')
      const [profile, wallet, tx, comm, topups, withdrawals, investments, bankRows, codeResult] = await Promise.all([
        db.from('profiles').select('full_name,mobile,preferred_currency').eq('id',id).maybeSingle(),
        db.from('wallet_balances').select('balance').eq('user_id',id).eq('currency','OMR').maybeSingle(),
        db.from('wallet_transactions').select('id,transaction_type,direction,amount,currency,status,description,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(300),
        db.from('commission_records').select('id,amount,currency,status,created_at,commission_type,description').eq('user_id',id).order('created_at',{ascending:false}).limit(300),
        db.from('topup_requests').select('id,amount,currency,status,created_at').eq('user_id',id).order('created_at',{ascending:false}).limit(200),
        db.from('withdrawal_requests').select('id,amount,currency,status,created_at,payout_details').eq('user_id',id).order('created_at',{ascending:false}).limit(200),
        db.from('investment_requests').select('id,amount,currency,status,created_at,property_name,plan_code').eq('user_id',id).order('created_at',{ascending:false}).limit(200),
        db.from('member_bank_accounts').select('id,account_holder,bank_name,iban,account_number,mobile_number,created_at').eq('user_id',id).order('created_at',{ascending:false}),
        db.rpc('member_has_withdrawal_password'),
      ])
      if(profile.error) throw profile.error
      if(wallet.error) throw wallet.error
      if(tx.error) throw tx.error
      if(comm.error) throw comm.error
      if(topups.error) throw topups.error
      if(withdrawals.error) throw withdrawals.error
      if(investments.error) throw investments.error
      if(bankRows.error) throw bankRows.error
      if(codeResult.error) throw new Error('Apply the account security migration first: '+codeResult.error.message)
      setName(profile.data?.full_name || auth.user.user_metadata?.full_name || auth.user.email?.split('@')[0] || 'Member')
      setMobile(profile.data?.mobile || auth.user.user_metadata?.mobile || '')
      let savedCurrency: string | null = null
      try { savedCurrency = window.localStorage.getItem('msheireb-currency') } catch { /* optional */ }
      const preferredCurrency = savedCurrency && currencies.includes(savedCurrency as Currency)
        ? savedCurrency
        : profile.data?.preferred_currency
      if (preferredCurrency && currencies.includes(preferredCurrency as Currency)) setCurrency(preferredCurrency as Currency)
      setBalance(Number(wallet.data?.balance ?? 0))
      const activeWithdrawals=(withdrawals.data ?? []).filter((r:any)=>norm(r.status)==='pending')
      setHold(activeWithdrawals.filter((r:any)=>r.currency==='OMR').reduce((n:number,r:any)=>n+Number(r.amount||0),0))
      setBanks((bankRows.data ?? []) as BankAccount[])
      setBankId((bankRows.data?.[0] as any)?.id ?? '')
      setHasWithdrawalCode(Boolean(codeResult.data))
      setProjects(investments.data?.length ?? 0)
      const commissionRows=(comm.data ?? []) as any[]
      const today=new Date().toISOString().slice(0,10)
      setTotalCommission(commissionRows.filter(r=>r.currency==='OMR' && ['credited','completed','approved','posted'].includes(norm(r.status))).reduce((n,r)=>n+Number(r.amount||0),0))
      setTodayRevenue(commissionRows.filter(r=>r.currency==='OMR' && String(r.created_at).slice(0,10)===today && ['credited','completed','approved','posted'].includes(norm(r.status))).reduce((n,r)=>n+Number(r.amount||0),0))
      setTrialBonus(commissionRows.filter(r=>norm(r.commission_type).includes('trial') && r.currency==='OMR').reduce((n,r)=>n+Number(r.amount||0),0))
      const mapped:RecordRow[]=[]
      for(const r of (tx.data ?? []) as any[]) { const source=norm([r.transaction_type,r.description].join(' ')); const type=source.includes('welcome bonus')?'Welcome bonus':source.includes('trial bonus')?'Trial bonus':source.includes('trial reset')?'Trial reset':source.includes('refund')?'Refund':source.includes('commission')?'Commission':source.includes('deposit')||source.includes('topup')?'Cash in':source.includes('withdrawal')?'Cash out':source.includes('investment')||source.includes('property')?'Property':source.includes('activation')||source.includes('profit')?'Activation':'Adjustment'; mapped.push({id:r.id,type,description:r.description || r.transaction_type,amount:(r.direction==='debit'?-1:1)*Number(r.amount),currency:r.currency,status:r.status,created_at:r.created_at}) }
      for(const r of commissionRows) mapped.push({id:r.id,type:'Commission',description:r.description || r.commission_type || 'Commission',amount:Number(r.amount),currency:r.currency,status:r.status,created_at:r.created_at})
      for(const r of (topups.data ?? []) as any[]) mapped.push({id:r.id,type:'Cash in',description:'Deposit request',amount:Number(r.amount),currency:r.currency,status:r.status,created_at:r.created_at})
      for(const r of (withdrawals.data ?? []) as any[]) if(['pending','rejected','cancelled'].includes(norm(r.status))) mapped.push({id:r.id,type:'Cash out',description:'Withdrawal request',amount:0,currency:r.currency,status:r.status,created_at:r.created_at})
      for(const r of (investments.data ?? []) as any[]) mapped.push({id:r.id,type:'Property',description:(r.plan_code || 'Project')+' · '+r.property_name,amount:Number(r.amount),currency:r.currency,status:r.status,created_at:r.created_at})
      setRecords(mapped.sort((a,b)=>Date.parse(b.created_at)-Date.parse(a.created_at)))
    } catch(e) {setError(e instanceof Error?e.message:'Could not load your account.')}
    finally {setLoading(false)}
  },[])

  useEffect(()=>{void load();const db=requireSupabase();const {data:listener}=db.auth.onAuthStateChange(()=>{void load()});return()=>listener.subscription.unsubscribe()},[load])

  async function saveBank(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      if(!userId) throw new Error('Please sign in again.')
      const {data,error:e}=await requireSupabase().from('member_bank_accounts').insert({user_id:userId,account_holder:accountHolder.trim(),bank_name:bankName.trim(),iban:iban.trim(),account_number:accountNumber.trim(),mobile_number:bankMobile.trim()}).select('id,account_holder,bank_name,iban,account_number,mobile_number,created_at').single()
      if(e) throw e
      setBanks(old=>[data as BankAccount,...old]);setBankId(data.id);setSection('bank');setAccountHolder('');setBankName('');setIban('');setAccountNumber('');setBankMobile('');setNotice('Bank account saved successfully.')
    }catch(e){setError(e instanceof Error?e.message:'Could not save bank account.')}finally{setBusy(false)}
  }

  async function requestCashOut(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      const value=Number(amount)
      if(!Number.isFinite(value)||value<20) throw new Error('Minimum OMR 20.')
      if(!bankId || !banks.some(b=>b.id===bankId)) throw new Error('No bank account is bound. Bind a bank account first.')
      if(!hasWithdrawalCode) throw new Error('Withdrawal password not set. Set withdrawal password first.')
      if(!/^\d{6,12}$/.test(withdrawalCode)) throw new Error('Enter your 6 to 12 digit withdrawal password.')
      const db=requireSupabase()
      const {data:valid,error:verifyError}=await db.rpc('member_verify_withdrawal_password',{p_password:withdrawalCode})
      if(verifyError) throw verifyError
      if(!valid) throw new Error('Incorrect withdrawal password.')
      const selected=banks.find(b=>b.id===bankId)!
      if(value>Math.max(0,balance-hold)) throw new Error('Insufficient available wallet balance.')
      const {error:insertError}=await db.from('withdrawal_requests').insert({user_id:userId,amount:value,currency:'OMR',status:'pending',payout_method:'Bank transfer',payout_details:{bank_account_id:selected.id,bank_name:selected.bank_name,account_holder:selected.account_holder,account_number_last4:selected.account_number.slice(-4),iban_last4:selected.iban.slice(-4)}})
      if(insertError) throw insertError
      setNotice('Cash out request submitted. Status: Pending administrator review.');setAmount('');setWithdrawalCode('');await load()
    }catch(e){setError(e instanceof Error?e.message:'Could not submit cash out request.')}finally{setBusy(false)}
  }

  async function saveWithdrawalCode(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      if(!/^\d{6,12}$/.test(newWithdrawalCode)) throw new Error('Use 6 to 12 digits.')
      if(newWithdrawalCode!==confirmWithdrawalCode) throw new Error('The withdrawal passwords do not match.')
      const {error:e}=await requireSupabase().rpc('member_set_withdrawal_password',{p_password:newWithdrawalCode})
      if(e) throw e
      setHasWithdrawalCode(true);setNewWithdrawalCode('');setConfirmWithdrawalCode('');setNotice('Withdrawal password saved.');setSection('withdrawalPassword')
    }catch(e){setError(e instanceof Error?e.message:'Could not save withdrawal password.')}finally{setBusy(false)}
  }

  async function changeLoginPassword(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');setNotice('')
    try{
      if(newPassword.length<8) throw new Error('New password must be at least 8 characters.')
      if(newPassword!==confirmPassword) throw new Error('The new passwords do not match.')
      const db=requireSupabase()
      const {error:checkError}=await db.auth.signInWithPassword({email,password:currentPassword})
      if(checkError) throw new Error('Current password is incorrect.')
      const {error:updateError}=await db.auth.updateUser({password:newPassword})
      if(updateError) throw updateError
      setCurrentPassword('');setNewPassword('');setConfirmPassword('');setNotice('Account password changed successfully.')
    }catch(e){setError(e instanceof Error?e.message:'Could not change password.')}finally{setBusy(false)}
  }

  useEffect(() => { let active = true; async function loadRates() {
    try { const response = await fetch('https://open.er-api.com/v6/latest/OMR', { cache: 'no-store' }); if (!response.ok) throw new Error('Live exchange rates are temporarily unavailable.');
      const payload = await response.json() as { result?: string; base_code?: string; time_last_update_utc?: string; rates?: Record<string, number> };
      if (payload.result !== 'success' || payload.base_code !== 'OMR' || !payload.rates) throw new Error('Invalid exchange-rate response.');
      const next: FxRates = { ...fallbackFxRates, OMR: 1 }; for (const code of currencies) { const rate = Number(payload.rates[code]); if (code !== 'OMR' && Number.isFinite(rate) && rate > 0) next[code] = rate; }
      if (active) { setFxRates(next); setFxDate(payload.time_last_update_utc ? new Date(payload.time_last_update_utc).toLocaleString('en-GB') : new Date().toLocaleString('en-GB')); setFxError(''); }
    } catch (cause) { if (active) setFxError(cause instanceof Error ? cause.message : 'Using reference rates.'); }
  } void loadRates(); const timer = window.setInterval(() => { void loadRates(); }, 300000); window.addEventListener('focus', loadRates);
  return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', loadRates); }; }, [])
  async function changeCurrency(next: Currency) {
    setCurrency(next)
    setError('')
    try {
      window.localStorage.setItem('msheireb-currency', next)
      window.dispatchEvent(new CustomEvent('msheireb-currency-change', { detail: next }))
    } catch { /* optional */ }
    if (userId) {
      const { error: updateError } = await requireSupabase().from('profiles').update({ preferred_currency: next }).eq('id', userId)
      if (updateError) setError('Currency display changed on this page, but could not save your preference: ' + updateError.message)
    }
  }
  const displayMoney = (value: number) => money(convertCurrency(value, 'OMR', currency, fxRates), currency)

  async function signOut(){const {error:e}=await requireSupabase().auth.signOut();if(e)setError(e.message);else await navigate({to:'/login'})}
  const filtered=records.filter(r=>(filter==='All'||norm(r.type)===norm(filter)))
  const activeBank=banks.find(b=>b.id===bankId)

  return <div className="dashboard-typography min-h-screen bg-[#faf9f7] text-[#25231f]">
    <WorkspaceSidebar mode="member"/>
    <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#e8e4dc] bg-white px-5 pl-20 lg:left-64 lg:px-7">
      <div className="text-xs text-[#777]">Workspace <span className="mx-2">/</span><strong className="text-[#25231f]">Account</strong></div>
      <div className="flex items-center gap-3"><label className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[#888]">CURRENCY<select aria-label="Account display currency" className="rounded-md border border-[#e6e1d8] bg-white px-3 py-2 text-xs" value={currency} onChange={e=>void changeCurrency(e.target.value as Currency)}>{currencies.map(c=><option key={c} value={c}>{c}</option>)}</select></label><div className="hidden rounded-lg border border-[#eee] px-3 py-2 text-xs sm:block">{name.split(' ')[0]} · User</div></div>
    </header>
    <main className="pb-12 pt-[82px] lg:ml-64"><div className="mx-auto max-w-[1500px] px-4 sm:px-7">
      {loading?<div className="rounded-xl border bg-white p-8 text-center text-sm text-[#777]">Loading your account…</div>:!userId?<div className="rounded-xl border bg-white p-8">Please <Link to="/login" className="underline">sign in</Link> to view your account.</div>:<>
        <section className="grid gap-3 rounded-xl border border-[#e4dfd8] bg-white p-4 shadow-sm md:grid-cols-[1fr_1fr] md:p-5">
          <div className="flex items-center gap-4"><div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-4 border-[#faf7f3] bg-[#f5f1ef] text-3xl font-semibold">{name.slice(0,1).toUpperCase()}</div><div className="min-w-0"><div className="flex items-center gap-2"><h1 className="text-xl font-semibold">{name}</h1><span className="rounded-full bg-[#f1e9e7] px-2 py-1 text-[10px]">Active</span></div><p className="text-xs text-[#85817b]">Mobile · {mobile || 'Not added'}</p></div></div>
          <div className="grid grid-cols-2 gap-2"><Stat value={String(projects)} label="Projects"/><Stat value={displayMoney(trialBonus)} label="Trial bonus"/><Stat value={displayMoney(todayRevenue)} label="Today's revenue"/><Stat value={displayMoney(hold)} label="On hold"/></div>
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2"><div className="flex items-center justify-between rounded-lg bg-[#201d1b] px-4 py-4 text-sm text-white"><span>Wallet balance</span><strong>{displayMoney(balance)}</strong></div><div className="flex items-center justify-between rounded-lg bg-[#f6edd4] px-4 py-4 text-sm text-[#625638]"><span>Hold balance</span><strong>{displayMoney(hold)}</strong></div></div>
          <p className="text-xs text-[#85817b] sm:col-span-2">Total commission: <strong>{displayMoney(totalCommission)}</strong></p>
          <p className="text-xs text-[#85817b] sm:col-span-2">{currency === "OMR" ? "OMR base currency." : "1 OMR = " + fxRates[currency].toFixed(6) + " " + currency} {fxDate ? "· Rate updated: " + fxDate : "· Reference rates in use"} · Auto-refresh every 5 minutes. {fxError}</p>
        </section>
        <div className="mt-4 grid items-start gap-4 lg:grid-cols-[263px_minmax(0,1fr)]">
          <nav className="overflow-hidden rounded-lg border border-[#e5e0da] bg-white">{menu.map(item=><button key={item.id} type="button" onClick={()=>{setSection(item.id);setError('');setNotice('')}} className={`flex w-full items-center justify-between border-b border-[#e8e4df] px-5 py-4 text-left text-sm last:border-0 ${section===item.id?'bg-[#f7f3f1] font-semibold text-[#28231f]':'text-[#444] hover:bg-[#fbfaf8]'}`}><span><span className="mr-4 text-base">{item.icon}</span>{item.label}</span><span className="text-[#aaa]">›</span></button>)}<button type="button" onClick={()=>void signOut()} className="w-full border-t border-[#e8e4df] px-5 py-5 text-left text-sm text-[#777]">↪　Log out</button></nav>
          <section className="min-h-[430px] rounded-xl border border-[#e5e0da] bg-white p-4 sm:p-6">
            {error?<p role="alert" className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>:null}
            {notice?<p role="status" className="mb-4 rounded-md bg-[#f7f1e4] p-3 text-sm text-[#625638]">{notice}</p>:null}
            {section==='records'?<><h2 className="display mb-5 text-3xl">Records</h2><div className="mb-4 flex flex-wrap gap-2">{['All','Welcome bonus','Trial bonus','Trial reset','Cash in','Activation','Property','Commission','Cash out','Refund','Adjustment'].map(x=><button key={x} type="button" onClick={()=>setFilter(x)} className={`rounded-lg border px-3 py-2 text-[11px] ${filter===x?'border-[#211e1c] bg-[#211e1c] text-white':'border-[#e5e1dc] text-[#666]'}`}>{x}</button>)}</div><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-xs"><thead><tr className="border-b text-[9px] uppercase tracking-widest text-[#999]"><th className="px-3 py-3">Type</th><th className="px-3 py-3">Description</th><th className="px-3 py-3">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Date</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b last:border-0"><td className="px-3 py-4">{r.type}</td><td className="px-3 py-4">{r.description}</td><td className="whitespace-nowrap px-3 py-4">{r.amount<0?'−':'+'}{money(Math.abs(r.amount),r.currency)}</td><td className="px-3 py-4"><span className="rounded-full bg-[#f2eae8] px-3 py-1 capitalize">{r.status}</span></td><td className="whitespace-nowrap px-3 py-4">{fmtDate(r.created_at)}</td></tr>)}{filtered.length===0?<tr><td colSpan={5} className="p-10 text-center text-[#888]">No records found for this filter.</td></tr>:null}</tbody></table></div></>:null}
            {section==='cashin'?<><h2 className="display text-3xl">Cash in</h2><p className="mt-3 text-sm text-[#777]">Submit a deposit request, then contact customer support for the payment instructions. Your wallet is credited only after administrator review.</p><Link to="/wallet#deposits" className="mt-6 inline-flex rounded-md bg-[#211e1c] px-5 py-3 text-sm text-white">Open deposit request</Link></>:null}
            {section==='cashout'?<><h2 className="display text-3xl">Cash out</h2><p className="mt-2 text-sm text-[#777]">Minimum OMR 20. Requests remain pending until an administrator reviews them.</p><form onSubmit={e=>void requestCashOut(e)} className="mt-6 grid max-w-xl gap-4"><div className="rounded-lg bg-[#f8f6f3] p-4 text-sm">Available wallet balance <strong className="float-right">{money(Math.max(0,balance-hold),'OMR')}</strong></div><label className="grid gap-2 text-xs text-[#777]">Bank account<select className={field} value={bankId} onChange={e=>setBankId(e.target.value)}><option value="">Select bound bank account</option>{banks.map(b=><option key={b.id} value={b.id}>{b.bank_name} ·••{b.account_number.slice(-4)}</option>)}</select></label>{!banks.length?<p className="text-sm text-red-700">No bank account is bound. Bind a bank account first. <button type="button" onClick={()=>setSection('bank')} className="underline">Bind wallet</button></p>:null}<label className="grid gap-2 text-xs text-[#777]">Amount (OMR)<input className={field} type="number" min="20" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} required/></label><label className="grid gap-2 text-xs text-[#777]">Withdrawal password{!hasWithdrawalCode?<span className="text-red-700">Not set · <button type="button" onClick={()=>setSection('withdrawalPassword')} className="underline">Set withdrawal password</button></span>:null}<input className={field} type="password" inputMode="numeric" maxLength={12} value={withdrawalCode} onChange={e=>setWithdrawalCode(e.target.value.replace(/\D/g,''))} placeholder="Enter withdrawal password" required/></label><div className="flex gap-3"><button type="button" onClick={()=>setSection('records')} className="rounded-md border px-5 py-3 text-sm">Cancel</button><button className={button} disabled={busy||!banks.length||!hasWithdrawalCode}>Request cash out</button></div></form></>:null}
            {section==='bank'?<><h2 className="display text-3xl">Bound accounts</h2><div className="mt-5 grid gap-3">{banks.map(b=><div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm"><div><strong>{b.bank_name}</strong><p className="mt-1 text-xs text-[#777]">{b.account_holder} · ••••{b.account_number.slice(-4)}</p><p className="text-xs text-[#777]">{b.iban?b.iban.slice(0,4)+'••••'+b.iban.slice(-4):'IBAN not supplied'}</p></div><button type="button" onClick={()=>setBankId(b.id)} className={bankId===b.id?'text-xs font-semibold text-[#92783d]':'text-xs underline'}>{bankId===b.id?'Selected':'Select for cash out'}</button></div>)}</div><button type="button" onClick={()=>setSection('bindForm')} className={`${button} mt-5`}>+ Bind wallet</button></>:null}
            {section==='bindForm'?<><h2 className="display text-3xl">Bind account</h2><form onSubmit={e=>void saveBank(e)} className="mt-5 grid max-w-xl gap-4"><label className="grid gap-2 text-xs text-[#777]">Account holder<input className={field} value={accountHolder} onChange={e=>setAccountHolder(e.target.value)} required maxLength={120}/></label><label className="grid gap-2 text-xs text-[#777]">Bank name<input className={field} value={bankName} onChange={e=>setBankName(e.target.value)} required maxLength={120}/></label><label className="grid gap-2 text-xs text-[#777]">IBAN<input className={field} value={iban} onChange={e=>setIban(e.target.value.toUpperCase())} placeholder="AE…" maxLength={34}/></label><label className="grid gap-2 text-xs text-[#777]">Account number<input className={field} value={accountNumber} onChange={e=>setAccountNumber(e.target.value)} required maxLength={34}/></label><label className="grid gap-2 text-xs text-[#777]">Mobile number<input className={field} value={bankMobile} onChange={e=>setBankMobile(e.target.value)} required inputMode="tel" maxLength={25} placeholder="Enter Number"/></label><div className="flex gap-3"><button type="button" onClick={()=>setSection('bank')} className="rounded-md border px-5 py-3 text-sm">Cancel</button><button className={button} disabled={busy}>Save account</button></div></form></>:null}
            {section==='password'?<><h2 className="display text-3xl">Change password</h2><form onSubmit={e=>void changeLoginPassword(e)} className="mt-5 grid max-w-md gap-4"><label className="grid gap-2 text-xs text-[#777]">Current password<input className={field} type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required autoComplete="current-password"/></label><label className="grid gap-2 text-xs text-[#777]">New password<input className={field} type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label><label className="grid gap-2 text-xs text-[#777]">Confirm new password<input className={field} type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required minLength={8} autoComplete="new-password"/></label><button className={button} disabled={busy}>Change password</button></form></>:null}
            {section==='withdrawalPassword'?<><h2 className="display text-3xl">{hasWithdrawalCode?'Change withdrawal password':'Set withdrawal password'}</h2><p className="mt-2 text-sm text-[#777]">Use 6–12 digits. This is separate from your account login password.</p><form onSubmit={e=>void saveWithdrawalCode(e)} className="mt-5 grid max-w-md gap-4"><label className="grid gap-2 text-xs text-[#777]">New withdrawal password<input className={field} type="password" inputMode="numeric" maxLength={12} value={newWithdrawalCode} onChange={e=>setNewWithdrawalCode(e.target.value.replace(/\D/g,''))} required/></label><label className="grid gap-2 text-xs text-[#777]">Confirm withdrawal password<input className={field} type="password" inputMode="numeric" maxLength={12} value={confirmWithdrawalCode} onChange={e=>setConfirmWithdrawalCode(e.target.value.replace(/\D/g,''))} required/></label><button className={button} disabled={busy}>Save withdrawal password</button></form></>:null}
            {section==='deposit'?<><h2 className="display text-3xl">About deposit</h2><p className="mt-4 text-sm leading-7 text-[#777]">To add funds, submit a Cash in request and contact Msheireb Properties customer support for the current deposit instructions. Funds are added to your wallet only after an administrator confirms and posts the credit. No card or crypto payment is available.</p><Link to="/support" className="mt-5 inline-flex rounded-md bg-[#211e1c] px-5 py-3 text-sm text-white">Contact support</Link></>:null}
            {section==='terms'?<><h2 className="display text-3xl">Terms & conditions</h2><div className="mt-4 space-y-3 text-sm leading-7 text-[#777]"><p>Wallet balances and records are internal account records. They do not by themselves confirm an external bank transfer or investment return.</p><p>Cash out requests require a bound bank account, a withdrawal password and a minimum request of AED 20. Requests are subject to administrator review and available balance checks.</p><p>Keep your account and withdrawal passwords private. Contact support if you notice activity you do not recognise.</p></div></>:null}
          </section>
        </div>
      </>}
    </div></main>
  </div>
}
function Stat({value,label}:{value:string;label:string}){return <div className="rounded-lg bg-[#f7f5f3] px-3 py-3"><strong className="block text-sm">{value}</strong><span className="mt-1 block text-[11px] text-[#85817b]">{label}</span></div>}
