import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { requireSupabase } from '../lib/supabase-client'

type Props = {
  mode: 'member' | 'admin'
  active?: string
  onSelect?: (id: string) => void
}
const memberItems = [
  ['dashboard','Dashboard','/dashboard'],
  ['wallet','My Wallet and Deposits','/wallet'],
  ['withdrawals','Withdrawals','/wallet#withdrawals'],
  ['transactions','Transactions and History','/wallet#transactions'],
  ['notifications','Notifications','/wallet#notifications'],
  ['account','My Profile and Verification','/account'],
  ['support','Telegram Support','/support'],
] as const
const adminItems = [
  ['overview','Overview'],['properties','Properties'],['enquiries','Enquiries'],
  ['users','Customers'],['promotions','Promotions'],['finance','Wallet'],
  ['investments','Investments'],['commissions','Commissions'],['verifications','ID Checks'],
  ['tasks','Tasks'],['payments','Payments'],['content','Journal'],
  ['team','Admin Team'],['support','Support'],['settings','Settings'],
] as const

export function WorkspaceSidebar({ mode, active, onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const [authReady, setAuthReady] = useState(mode === 'admin')
  const [authenticated, setAuthenticated] = useState(mode === 'admin')
  const location = useLocation()
  const isAdmin = mode === 'admin'

  useEffect(() => {
    if (isAdmin) return
    const client = requireSupabase()
    let mounted = true
    void client.auth.getUser().then(({ data }) => {
      if (mounted) {
        setAuthenticated(Boolean(data.user))
        setAuthReady(true)
      }
    }).catch(() => {
      if (mounted) {
        setAuthenticated(false)
        setAuthReady(true)
      }
    })
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setAuthenticated(Boolean(session?.user))
        setAuthReady(true)
        if (!session?.user) setOpen(false)
      }
    })
    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [isAdmin])

  if (!isAdmin && (!authReady || !authenticated)) return null

  const items = isAdmin ? adminItems : memberItems
  return <>
    <button type="button" aria-label="Open workspace navigation" onClick={() => setOpen(true)}
      className="fixed left-4 top-4 z-[70] flex h-11 w-11 items-center justify-center border border-brass/50 bg-[#101d35] text-xl text-[#d8b56d] shadow-lg lg:hidden">☰</button>
    {open ? <button aria-label="Close navigation overlay" onClick={() => setOpen(false)} className="fixed inset-0 z-[60] bg-black/55 lg:hidden" /> : null}
    <aside className={['fixed inset-y-0 left-0 z-[65] flex w-64 flex-col border-r border-white/10 bg-[#101d35] text-white shadow-2xl transition-transform duration-200', open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'].join(' ')}>
      <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-6">
        <div><p className="display text-lg tracking-wide text-white">MSHEIREB</p><p className="eyebrow mt-1 text-[0.48rem] tracking-[0.2em] text-[#d8b56d]">{isAdmin ? 'ADMINISTRATION' : 'PRIVATE MEMBER'}</p></div>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="text-xl text-white/70 lg:hidden">×</button>
      </div>
      <nav aria-label={isAdmin ? 'Admin navigation' : 'Customer navigation'} className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {items.map((item) => {
          const id = item[0]
          const label = item[1]
          const href = isAdmin ? undefined : (item as readonly [string, string, string])[2]
          const selected = isAdmin ? active === id : location.pathname === href?.split('#')[0] && (href?.includes('#') ? location.hash === '#' + href.split('#')[1] : true)
          const cls = ['flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left text-sm transition-colors', selected ? 'border-l-2 border-[#d8b56d] bg-white/10 text-[#e7c77f]' : 'border-l-2 border-transparent text-white/75 hover:bg-white/5 hover:text-white'].join(' ')
          return isAdmin ? <button key={id} type="button" className={cls} onClick={() => { onSelect?.(id); setOpen(false) }}><span className="w-5 text-center text-[#d8b56d]">◇</span>{label}</button>
            : <Link key={id} to={href as any} onClick={() => setOpen(false)} className={cls}><span className="w-5 text-center text-[#d8b56d]">◇</span>{label}</Link>
        })}
      </nav>
      <div className="border-t border-white/10 px-6 py-4"><p className="text-[10px] tracking-widest text-white/45">DUBAI · UNITED ARAB EMIRATES</p></div>
    </aside>
  </>
}
