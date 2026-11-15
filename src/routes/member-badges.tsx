import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

type Badge = { id: string; level: 'Senior' | 'Master' | 'Expert'; badge_number: number; title: string; icon: string; is_locked: boolean }
type Progress = { id: string; badge_id: string; status: 'locked' | 'unlocked' | 'support_requested' | 'completed'; project_badges: Badge }
type Assignment = { id: string; badge_id: string; property_id: string; position: number; properties: { id: string; name: string; location: string | null; description: string | null; price_label: string; cover_image_url: string | null } }
type Order = { id: string; badge_id: string; property_id: string; status: 'ordered' | 'completed' | 'cancelled' }

export const Route = createFileRoute('/member-badges')({ component: MemberBadgesPage })

function MemberBadgesPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [progress, setProgress] = useState<Progress[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [selectedLevel, setSelectedLevel] = useState<'Senior' | 'Master' | 'Expert'>('Senior')
  const [selectedBadgeId, setSelectedBadgeId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [achievement, setAchievement] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase) { setError('Member services are not configured.'); setLoading(false); return }
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { setLoading(false); void navigate({ to: '/login' }); return }
    const [progressResult, orderResult] = await Promise.all([
      supabase.from('member_badge_progress').select('id,badge_id,status,project_badges(id,level,badge_number,title,icon,is_locked)').eq('user_id', auth.user.id),
      supabase.from('member_project_orders').select('id,badge_id,property_id,status').eq('user_id', auth.user.id),
    ])
    if (progressResult.error) setError(progressResult.error.message)
    if (orderResult.error) setError(orderResult.error.message)
    const rows = (progressResult.data ?? []) as unknown as Progress[]
    setProgress(rows)
    setOrders((orderResult.data ?? []) as Order[])
    const unlocked = rows.find(row => row.status === 'unlocked' && !row.project_badges.is_locked)
    if (unlocked) {
      const [assignmentResult] = await Promise.all([
        supabase.from('project_badge_properties').select('id,badge_id,property_id,position,properties(id,name,location,description,price_label,cover_image_url)').eq('badge_id', unlocked.badge_id).order('position'),
      ])
      if (assignmentResult.error) setError(assignmentResult.error.message)
      setAssignments((assignmentResult.data ?? []) as unknown as Assignment[])
      setSelectedLevel(unlocked.project_badges.level)
      setSelectedBadgeId(unlocked.badge_id)
    } else {
      setAssignments([])
    }
    setLoading(false)
  }, [navigate])

  useEffect(() => { void load() }, [load])

  const activeProgress = progress.find(row => row.badge_id === selectedBadgeId)
  const activeBadge = activeProgress?.project_badges
  const activeAssignments = assignments.filter(row => row.badge_id === selectedBadgeId).sort((a,b) => a.position-b.position)
  const activeOrders = orders.filter(row => row.badge_id === selectedBadgeId)
  const completedCount = activeOrders.filter(row => row.status === 'completed').length
  const pendingOrder = activeOrders.find(row => row.status === 'ordered')
  const nextAssignment = activeAssignments.find(row => !activeOrders.some(order => order.property_id === row.property_id && order.status !== 'cancelled'))
  const allDone = activeAssignments.length === 20 && completedCount === 20

  const placeOrder = async (assignment: Assignment) => {
    if (!supabase || !activeProgress || activeProgress.status !== 'unlocked' || activeBadge?.is_locked) return
    setBusy(true); setError(null); setNotice(null)
    const { data: auth } = await supabase.auth.getUser()
    if (!auth.user) { void navigate({ to: '/login' }); return }
    const { error: insertError } = await supabase.from('member_project_orders').insert({
      user_id: auth.user.id, badge_id: selectedBadgeId, property_id: assignment.property_id, status: 'ordered',
    })
    if (insertError) setError(insertError.message)
    else { setNotice('Property order submitted. The next property will become available after this order is marked completed by the administrator.'); await load() }
    setBusy(false)
  }

  const requestNextBadge = async () => {
    if (!supabase || !activeBadge || activeProgress?.status !== 'completed') return
    const nextBadge = progress.find(row => row.project_badges.level === activeBadge.level && row.project_badges.badge_number === activeBadge.badge_number + 1)
    if (!nextBadge) { setNotice('You have completed all three badges in this level. Please contact Customer Support.'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error: requestError } = await supabase.from('member_badge_progress').update({ status: 'support_requested', support_requested_at: new Date().toISOString() }).eq('id', nextBadge.id)
    if (requestError) setError(requestError.message)
    else { setNotice('Your unlock request has been sent. Please contact Customer Support for assistance.'); await load() }
    setBusy(false)
  }

  const badgeIcon = (icon: string) => icon === 'gem' ? '◆' : icon === 'trophy' ? '🏆' : '♛'
  const moneyLabel = (value: string) => value || 'Price on request'

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-[#171b2a]">
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl px-5 pb-20 pt-32 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#e7e6e1] pb-7">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a18a58]">Private member area</p><h1 className="display mt-3 text-4xl">My badges</h1><p className="mt-3 text-sm text-[#777]">Senior, Master and Expert progression · 20 properties per badge.</p></div>
          <Link to="/dashboard" className="border border-[#e7e6e1] px-5 py-3 text-sm">Back to dashboard</Link>
        </div>
        {error ? <p role="alert" className="mt-6 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
        {notice ? <p role="status" className="mt-6 border border-[#d9c99e] bg-[#fbf8ef] px-4 py-3 text-sm">{notice}</p> : null}
        {loading ? <p className="py-12 text-sm text-[#777]">Loading your badges…</p> : (
          <>
            <div className="mt-7 flex flex-wrap gap-2">{(['Senior','Master','Expert'] as const).map(level => <button key={level} type="button" onClick={() => setSelectedLevel(level)} className={selectedLevel===level?'bg-[#101d32] px-5 py-3 text-sm text-white':'border border-[#e3dfd5] bg-white px-5 py-3 text-sm'}>{level}</button>)}</div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">{[1,2,3].map(number => { const row=progress.find(item=>item.project_badges.level===selectedLevel && item.project_badges.badge_number===number); const badge=row?.project_badges; return <button key={number} type="button" disabled={!row} onClick={()=>{if(row){setSelectedBadgeId(row.badge_id);setAssignments([]); if(row.status==='unlocked'&&!row.project_badges.is_locked){void (async()=>{const {data}=await supabase!.from('project_badge_properties').select('id,badge_id,property_id,position,properties(id,name,location,description,price_label,cover_image_url)').eq('badge_id',row.badge_id).order('position');setAssignments((data??[]) as unknown as Assignment[])})()}}}} className={'border p-5 text-left '+(row?.badge_id===selectedBadgeId?'border-[#b89b59] bg-[#f8f4e9]':'border-[#e7e6e1] bg-white')+' disabled:opacity-50'}><span className="text-3xl text-[#b89b59]">{badgeIcon(badge?.icon??(number===1?'gem':number===2?'trophy':'crown'))}</span><span className="mt-3 block font-semibold">{'Badge '+number}</span><span className="mt-1 block text-xs capitalize text-[#777]">{row?.status.replace('_',' ')??'Not activated'}</span></button> })}</div>
            {activeBadge && activeProgress ? (
              <section className="mt-8 border border-[#e7e6e1] bg-white p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#a18a58]">{activeBadge.level}</p><h2 className="display mt-2 text-3xl">{activeBadge.title}</h2><p className="mt-2 text-sm text-[#777]">{completedCount} of 20 properties completed</p></div><div className="text-4xl text-[#b89b59]">{badgeIcon(activeBadge.icon)}</div></div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-[#eeeae1]"><div className="h-full bg-[#b89b59]" style={{width:Math.min(100,completedCount/20*100)+'%'}} /></div>
                {activeProgress.status==='completed' || allDone ? <div role="dialog" aria-modal="true" aria-labelledby="badge-achieved-title" className="fixed inset-0 z-50 grid place-items-center bg-[#071426]/75 p-5"><section className="w-full max-w-md border border-[#d9c99e] bg-white p-7 text-center shadow-2xl sm:p-9"><div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#f8f4e9] text-5xl text-[#b89b59]">{badgeIcon(activeBadge.icon)}</div><p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#a18a58]">Achievement unlocked</p><h3 id="badge-achieved-title" className="display mt-2 text-3xl">Congratulations!</h3><p className="mt-2 text-lg font-semibold text-[#172238]">{activeBadge.title} Achieved!</p><p className="mt-3 text-sm leading-6 text-[#777]">Please contact Customer Support to unlock your next badge.</p><button type="button" disabled={busy} onClick={()=>void requestNextBadge()} className="mt-6 w-full bg-[#101d32] px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-50">Request next badge unlock</button></section></div> : null}
                {activeProgress.status==='support_requested' ? <p className="mt-6 border border-[#d9c99e] p-4 text-sm">Your next badge unlock request is pending administrator approval.</p> : null}
                {activeProgress.status==='locked' ? <p className="mt-6 border border-[#e7e6e1] p-4 text-sm text-[#777]">This badge is locked. Complete the previous badge and contact Customer Support to request access.</p> : null}
                {activeProgress.status==='unlocked' && !activeBadge.is_locked ? <div className="mt-7 space-y-3">{activeAssignments.map((assignment,index)=>{const order=activeOrders.find(item=>item.property_id===assignment.property_id && item.status!=='cancelled');const isNext=nextAssignment?.id===assignment.id;return <article key={assignment.id} className="grid gap-4 border-t border-[#eeeae1] py-5 sm:grid-cols-[112px_1fr_auto] sm:items-center">{assignment.properties.cover_image_url?<img src={assignment.properties.cover_image_url} alt="" className="h-24 w-full rounded-lg object-cover sm:w-28"/>:<div className="grid h-24 place-items-center bg-[#f0eee8] text-xs text-[#777]">Property {index+1}</div>}<div><p className="text-xs text-[#a18a58]">Property {index+1} of 20</p><h3 className="mt-1 font-semibold">{assignment.properties.name}</h3><p className="mt-1 text-xs text-[#777]">{assignment.properties.location} · {moneyLabel(assignment.properties.price_label)}</p><p className="mt-2 text-xs capitalize text-[#777]">{order?.status??(isNext?'Ready to order':'Locked until previous order is completed')}</p></div>{order?<span className="border border-[#e7e6e1] px-4 py-2 text-xs capitalize">{order.status}</span>:isNext?<button type="button" disabled={busy || !!pendingOrder} onClick={()=>void placeOrder(assignment)} className="bg-[#101d32] px-4 py-3 text-xs text-white disabled:opacity-50">{busy?'Submitting…':'Order property'}</button>:<span className="text-xs text-[#999]">Locked</span>}</article>})}</div> : null}
              </section>
            ) : <section className="mt-8 border border-[#e7e6e1] bg-white p-8"><h2 className="display text-2xl">Your badge access</h2><p className="mt-3 text-sm leading-6 text-[#777]">Your Senior, Master or Expert badge access has not been activated yet. Please contact Customer Support or ask an administrator to activate your level.</p><p className="mt-3 text-xs text-[#999]">Junior Trial is managed separately and is not changed by this badge system.</p></section>}
          </>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
