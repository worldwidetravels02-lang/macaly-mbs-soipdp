import { useEffect, useState } from 'react'
import { Link, useLocation } from '@tanstack/react-router'
import { requireSupabase } from '../lib/supabase-client'

type Props = {
  mode: 'member' | 'admin'
  active?: string
  onSelect?: (id: string) => void
  isOwner?: boolean
}
const memberItems = [
  ['dashboard','Dashboard','/dashboard'],
  ['projects','Projects','/residences'],
  ['orders','Orders','/orders'],
  ['account','Account','/account'],
  ['support','Support','/support'],
] as const
const adminItems = [
  ['overview','Dashboard'],
  ['users','Users'],
  ['properties','Projects'],
  ['finance','Cashout'],
  ['transactions','Transactions'],
  ['support','Support'],
  ['settings','Settings'],
  ['team','Add Admin'],
] as const

export function WorkspaceSidebar({ mode, active, onSelect, isOwner = false }: Props) {
  const [open, setOpen] = useState(false)
  const [authReady, setAuthReady] = useState(mode === 'admin')
  const [authenticated, setAuthenticated] = useState(mode === 'admin')
  const location = useLocation()
  const isAdmin = mode === 'admin'
  const signOut = async () => {
    const { error } = await requireSupabase().auth.signOut()
    if (!error) window.location.assign('/login')
  }

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
    <aside className={['fixed inset-y-0 left-0 z-[65] flex w-64 flex-col border-r shadow-sm transition-transform duration-200', isAdmin ? 'border-white/10 bg-[#101d35] text-white shadow-2xl' : 'border-white/10 bg-[#101d35] text-white shadow-2xl', open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'].join(' ')}>
      <div className={["flex min-h-20 items-center justify-between border-b px-4", "border-white/10"].join(" ")}>
        <Link to={isAdmin ? "/admin" : "/dashboard"} aria-label="Msheireb Properties home" className="flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#d8b56d]/70 text-[#d8b56d]"><span className="display text-xl">M</span></span>
          <span className="min-w-0 leading-tight"><span className="block truncate text-[11px] font-semibold tracking-[0.16em] text-white">MSHEIREB</span><span className="mt-1 block truncate text-[8px] tracking-[0.18em] text-[#d8b56d]">{isAdmin ? "ADMINISTRATION" : "PROPERTIES"}</span></span>
        </Link>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close navigation" className="text-xl text-[#777] lg:hidden">×</button>
      </div>
      <nav aria-label={isAdmin ? 'Admin navigation' : 'Customer navigation'} className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        {items.map((item) => {
          const id = item[0]
          const label = item[1]
          const href = isAdmin ? undefined : (item as readonly [string, string, string])[2]
          const selected = isAdmin ? active === id : location.pathname === href?.split('#')[0] && (href?.includes('#') ? location.hash === '#' + href.split('#')[1] : true)
          const cls = ['flex w-full items-center gap-3 rounded-sm px-4 py-3 text-left text-sm transition-colors', isAdmin ? (selected ? 'border-l-2 border-[#d8b56d] bg-white/10 text-[#e7c77f]' : 'border-l-2 border-transparent text-white/75 hover:bg-white/5 hover:text-white') : (selected ? 'border-l-2 border-[#d8b56d] bg-white/10 font-semibold text-[#e7c77f]' : 'border-l-2 border-transparent text-white/70 hover:bg-white/5 hover:text-white')].join(' ')
          return isAdmin ? <button key={id} type="button" className={cls} onClick={() => { onSelect?.(id); setOpen(false) }}><span className="w-5 text-center text-[#d8b56d]">◇</span>{label}</button>
            : <Link key={id} to={href as any} onClick={() => setOpen(false)} className={cls}><span className="w-5 text-center text-[#d8b56d]">◇</span>{label}</Link>
        })}
      </nav>
      <div className={["border-t px-5 py-4", "border-white/10"].join(" ")}>{isAdmin ? <p className="text-[10px] tracking-widest text-white/45">DUBAI · UNITED ARAB EMIRATES</p> : <button type="button" onClick={() => void signOut()} className="flex w-full items-center gap-3 py-2 text-left text-sm text-white/65 transition hover:text-[#e7c77f]"><span aria-hidden="true">↪</span>Log out</button>}</div>
    </aside>
    {isAdmin ? <nav aria-label="Admin quick navigation" className="fixed inset-x-0 bottom-0 z-[80] grid grid-cols-8 border-t border-[#e8e4dc] bg-white px-1 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-2 shadow-[0_-4px_18px_rgba(0,0,0,0.08)] lg:hidden">
      {adminItems.map(([id, label]) => <button key={id} type="button" onClick={() => onSelect?.(id)} className={['flex min-w-0 flex-col items-center justify-center gap-1 py-1 text-[0.62rem]', active === id ? 'font-semibold text-[#171717]' : 'text-[#777]'].join(' ')}>
        <span aria-hidden="true" className="text-lg leading-5">{id === 'overview' ? '⌂' : id === 'users' ? '♙' : id === 'properties' ? '▦' : id === 'finance' ? '▱' : id === 'transactions' ? '≡' : id === 'support' ? '✉' : id === 'team' ? '＋' : '☼'}</span>
        <span className="truncate">{label}</span>
      </button>)}
    </nav> : null}
  </>
}
