import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { ListingsGate } from '../components/listings-gate'
import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences']
const LEVELS = ['Junior Trial', 'Senior', 'Master', 'Expert'] as const
const SAMPLE_IMAGES = [IMAGES.tower, IMAGES.living, IMAGES.villas, IMAGES.pool, IMAGES.lowrise, IMAGES.detail, IMAGES.bath, IMAGES.rooftop, IMAGES.penthouse, IMAGES.beachVilla, IMAGES.bedroom, IMAGES.marinaNight, IMAGES.courtyard, IMAGES.kitchen]

type Project = {
  id: string
  slug: string
  name: string
  location: string | null
  description: string | null
  price_label: string
  price_amount: number | null
  order_percentages: number[]
  cover_image_url: string | null
  project_level: string
  sort_order: number
}
type ProjectRequest = { user_id: string; property_id: string | null; status: string }

export const Route = createFileRoute('/residences/')({
  validateSearch: (search: Record<string, unknown>) => ({
    level: typeof search.level === 'string' && LEVELS.includes(search.level as typeof LEVELS[number]) ? search.level : undefined,
  }),
  head: () => {
    const canonical = canonicalUrl('/residences')
    return { meta: [{ title: meta.title }, { name: 'description', content: meta.description }], links: canonical ? [{ rel: 'canonical', href: canonical }] : [] }
  },
  component: ResidencesPage,
})

function ResidencesPage() {
  const search = Route.useSearch()
  const navigate = useNavigate({ from: '/residences/' })
  const [checkingSession, setCheckingSession] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [customerLevelAccess, setCustomerLevelAccess] = useState<{ user_id: string; level_name: string; is_unlocked: boolean }[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>(search.level ?? 'Junior Trial')
  const [groupSearch, setGroupSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'trial'>('all')
  const [groupSort, setGroupSort] = useState<'oldest' | 'newest'>('oldest')
  const [currency, setCurrency] = useState('AED')
  const [currentUserName, setCurrentUserName] = useState('Member')
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0)
  const [walletBalanceAed, setWalletBalanceAed] = useState(0)
  const [projectSort, setProjectSort] = useState<'admin' | 'name' | 'price'>('admin')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [busyProject, setBusyProject] = useState('')
  const [notice, setNotice] = useState('')
  const [successPopup, setSuccessPopup] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (search.level && LEVELS.includes(search.level as typeof LEVELS[number])) {
      setSelectedLevel(search.level)
      setCurrentProjectIndex(0)
    }
  }, [search.level])

  useEffect(() => {
    const client = requireSupabase()
    let active = true
    client.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return
      if (sessionError) setError(sessionError.message)
      setSignedIn(Boolean(data.session?.user))
      setCheckingSession(false)
    }).catch((cause) => {
      if (active) { setError(cause instanceof Error ? cause.message : 'Could not check your sign-in.'); setCheckingSession(false) }
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session?.user)))
    return () => { active = false; data.subscription.unsubscribe() }
  }, [])

  useEffect(() => {
    if (!signedIn) return
    let active = true
    setLoadingProjects(true)
    ;(async () => {
      const client = requireSupabase()
      const [propertyResult, requestResult, userResult, accessResult, walletResult] = await Promise.all([
        client.from('properties').select('id,slug,name,location,description,price_label,price_amount,order_percentages,cover_image_url,project_level,sort_order').eq('status', 'published').not('project_level', 'is', null).order('sort_order', { ascending: true }),
        client.from('investment_requests').select('user_id,property_id,status').order('created_at', { ascending: false }),
        client.auth.getUser(),
        client.from('customer_project_level_access').select('user_id,level_name,is_unlocked'),
        client.from('wallet_balances').select('balance').eq('currency', 'OMR').maybeSingle(),
      ])
      if (propertyResult.error) throw propertyResult.error
      if (userResult.error) throw userResult.error
      if (requestResult.error) throw requestResult.error
      if (accessResult.error) throw accessResult.error
      if (walletResult.error) throw walletResult.error
      if (!userResult.data.user) throw new Error('Please sign in to view the project catalogue.')
      if (!active) return
      setProjects((propertyResult.data ?? []) as Project[])
      setRequests((requestResult.data ?? []) as ProjectRequest[])
      setCurrentUserId(userResult.data.user.id)
      setCurrentUserName(String(userResult.data.user.user_metadata?.full_name || userResult.data.user.email?.split('@')[0] || 'Member'))
      setCustomerLevelAccess((accessResult.data ?? []) as { user_id: string; level_name: string; is_unlocked: boolean }[])
      const walletOemBalance = Number(walletResult.data?.balance ?? 0)
      let aedRate = 9.55
      try {
        const fxResponse = await fetch('https://open.er-api.com/v6/latest/OMR', { cache: 'no-store' })
        if (fxResponse.ok) {
          const fxPayload = await fxResponse.json() as { result?: string; base_code?: string; rates?: Record<string, number> }
          const liveRate = Number(fxPayload.rates?.AED)
          if (fxPayload.result === 'success' && fxPayload.base_code === 'OMR' && Number.isFinite(liveRate) && liveRate > 0) aedRate = liveRate
        }
      } catch { /* use the same reference rate as the wallet page */ }
      if (!active) return
      setWalletBalanceAed(walletOemBalance * aedRate)
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the project catalogue.')
    }).finally(() => { if (active) setLoadingProjects(false) })
    return () => { active = false }
  }, [signedIn])

  const currentLevelUnlocked = customerLevelAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel)?.is_unlocked ?? selectedLevel === 'Junior Trial'
  const levelProjects = useMemo(() => projects.filter((project) => project.project_level === selectedLevel), [projects, selectedLevel])
  const visibleProjects = useMemo(() => {
    const rows = [...levelProjects]
    if (projectSort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    if (projectSort === 'price') rows.sort((a, b) => Number(a.price_amount ?? 0) - Number(b.price_amount ?? 0))
    return rows
  }, [levelProjects, projectSort])
  const projectCards: (Project | null)[] = Array.from({ length: 20 }, (_, index) => visibleProjects[index] ?? null)
  useEffect(() => {
    if (!currentUserId) return
    const orderedPropertyIds = new Set(requests
      .filter((request) => request.user_id === currentUserId && request.property_id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))
      .filter((request) => levelProjects.some((project) => project.id === request.property_id))
      .map((request) => request.property_id))
    setCurrentProjectIndex(Math.min(orderedPropertyIds.size, 20))
  }, [currentUserId, requests, levelProjects])

  async function requestProject(project: Project) {
    const selection = { quantity: 1, percentage: Number(project.order_percentages?.[0] ?? 0) }
    const basePrice = Number(project.price_amount || 0)
    const amount = Math.round(basePrice * selection.quantity * 100) / 100
    const commissionAmount = Math.round(amount * selection.percentage) / 100
    if (!basePrice || !Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(amount) || amount <= 0) {
      setError('This project is not ready for orders. Ask the administrator to set its confirmed numeric price first.')
      return
    }
    if (!project.order_percentages?.length || !Number.isFinite(selection.percentage)) {
      setError('This property is not ready for orders. Ask the administrator to set its percentage first.')
      return
    }
    setBusyProject(project.id); setError(''); setNotice('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      if (!auth.user) throw new Error('Please sign in again before placing an order.')
      const { error: insertError } = await client.from('investment_requests').insert({
        user_id: auth.user.id,
        property_id: project.id,
        property_name: project.name,
        plan_code: 'project_order',
        amount,
        currency: 'AED',
        commission_percent: selection.percentage,
        expected_commission: commissionAmount,
        note: `Project order · Level: ${project.project_level} · Percentage: ${selection.percentage}% · Base price: AED ${basePrice.toFixed(2)} · Order amount: AED ${amount.toFixed(2)} · Expected commission: AED ${commissionAmount.toFixed(2)}`,
      })
      if (insertError) throw insertError
      const updatedRequests = [...requests, { user_id: auth.user.id, property_id: project.id, status: 'pending' }]
      setRequests(updatedRequests)
      const orderedPropertyIds = new Set(updatedRequests
        .filter((request) => request.user_id === auth.user.id && request.property_id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))
        .filter((request) => projects.some((item) => item.id === request.property_id && item.project_level === selectedLevel))
        .map((request) => request.property_id))
      const nextLevel = LEVELS[LEVELS.indexOf(selectedLevel as typeof LEVELS[number]) + 1]
      if (orderedPropertyIds.size >= 20 && nextLevel) {
        setNotice(`Congratulations! You have completed 20 different properties in ${selectedLevel}. The administrator has been notified. ${nextLevel} will unlock after admin approval.`)
        setSuccessPopup(true)
        window.setTimeout(() => {
          setSuccessPopup(false)
          setNotice('')
        }, 2600)
      } else {
        setNotice('Your project order request has been sent to the administrator for review.')
        setSuccessPopup(true)
        window.setTimeout(() => {
          setSuccessPopup(false)
          setNotice('')
        }, 1800)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your project order.')
    } finally { setBusyProject('') }
  }

  const visibleLevels = useMemo(() => {
    const query = groupSearch.trim().toLowerCase()
    let rows = LEVELS.filter((level) => (!query || level.toLowerCase().includes(query)) && (groupFilter === 'all' || level === 'Junior Trial'))
    if (groupSort === 'newest') rows = [...rows].reverse()
    return rows
  }, [groupSearch, groupFilter, groupSort])

  return (
    <div className="dashboard-typography min-h-screen bg-[#faf9f7] text-[#25231f]">
      <WorkspaceSidebar mode="member" />
      <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#c9a45c] bg-[#071b38]/95 px-5 pl-20 text-white shadow-lg backdrop-blur lg:left-64 lg:px-7">
        <div className="text-xs text-white/70"><span>Workspace</span><span className="mx-2 text-[#d8b66b]">/</span><strong className="text-[#f1d28d]">Projects</strong></div>
        <div className="flex items-center gap-3 sm:gap-5">
          <label className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[#888]">CURRENCY
            <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-md border border-[#c9a45c]/60 bg-[#10294b] px-3 py-2 text-xs font-semibold text-white"><option>AED</option><option>OMR</option><option>SAR</option><option>KWD</option><option>BHD</option><option>QAR</option></select>
          </label>
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-[#c9a45c]/50 bg-[#10294b] px-2 py-1.5 text-xs text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d8b66b] font-semibold text-[#071b38]">{currentUserName.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{currentUserName.split(" ")[0]}</strong><span className="text-[10px] text-[#888]">User</span></span></Link>
        </div>
      </header>
      {successPopup ? <div role="status" aria-live="polite" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#071b38]/65 px-5 backdrop-blur-sm"><div className="w-full max-w-sm rounded-2xl border border-[#d8b66b] bg-white p-8 text-center shadow-2xl animate-[orderPop_.35s_ease-out]"><div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-[#e8f5ec] text-3xl font-bold text-[#23834b]">✓</div><h2 className="display text-2xl text-[#071b38]">{notice.startsWith('Congratulations!') ? 'Congratulations!' : 'Order successful'}</h2><p className="mt-2 text-sm text-[#666]">{notice || 'Your request has been sent for admin review.'}</p><p className="mt-4 text-xs tracking-wide text-[#9a793b]">{notice.startsWith('Congratulations!') ? 'Waiting for administrator approval…' : 'Opening the next property…'}</p></div><style>{'@keyframes orderPop { 0% { opacity: 0; transform: scale(.82) translateY(12px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }'}</style></div> : null}
      
      <main id="main" className="pb-20 pt-[86px] lg:ml-64">
        <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-7">
        {checkingSession ? <p className="mx-auto w-full max-w-7xl px-5 py-16 text-sm text-ink-soft sm:px-8">Checking your session…</p> : !signedIn ? <ListingsGate /> : (
          <section className="py-12 sm:py-16">
            <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
              {error ? <p role="alert" className="mb-5 border border-destructive/40 p-4 text-sm text-destructive">{error}</p> : null}

              <div className="mb-6 flex items-center justify-between gap-3">
                {search.level ? <Link to="/residences" className="eyebrow inline-flex items-center gap-2 text-[0.55rem] text-brass">← All project groups</Link> : <span />}
                <h1 className="display text-3xl text-[#25231f]">{search.level ? (selectedLevel === 'Junior Trial' ? 'Junior (Trial)' : selectedLevel) : 'Projects'}</h1>
              </div>
              {!search.level ? <>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <label className="flex min-h-[50px] w-full max-w-[420px] items-center gap-3 rounded-lg border border-[#e5e1da] bg-white px-4"><span aria-hidden="true" className="text-lg text-[#888]">⌕</span><input value={groupSearch} onChange={(event) => setGroupSearch(event.target.value)} type="search" placeholder="Search groups" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => setGroupFilter("all")} className={groupFilter === "all" ? "rounded-lg bg-[#201f1d] px-3 py-2 text-xs text-white" : "rounded-lg border border-[#e5e1da] bg-white px-3 py-2 text-xs text-[#444]"}>All</button>
                  <button type="button" onClick={() => setGroupFilter("trial")} className={groupFilter === "trial" ? "rounded-lg bg-[#201f1d] px-3 py-2 text-xs text-white" : "rounded-lg border border-[#e5e1da] bg-white px-3 py-2 text-xs text-[#444]"}>Trial</button>
                  <select aria-label="Sort project groups" value={groupSort} onChange={(event) => setGroupSort(event.target.value as typeof groupSort)} className="rounded-lg border border-[#e5e1da] bg-white px-3 py-2 text-xs text-[#444]"><option value="oldest">Oldest first</option><option value="newest">Newest first</option></select>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {visibleLevels.map((level) => {
                  const unlocked = customerLevelAccess.find((item) => item.user_id === currentUserId && item.level_name === level)?.is_unlocked ?? level === 'Junior Trial'
                  const isTrial = level === 'Junior Trial'
                  const levelImage = isTrial ? IMAGES.marinaNight : level === "Senior" ? IMAGES.tower : level === "Master" ? IMAGES.detail : IMAGES.villas
                  const levelProperties = projects.filter((project) => project.project_level === level)
                  const count = levelProperties.length
                  const prices = levelProperties.map((project) => Number(project.price_amount)).filter((price) => Number.isFinite(price) && price > 0)
                  const startingPrice = prices.length ? Math.min(...prices) : null
                  const percentages = levelProperties.flatMap((project) => project.order_percentages ?? []).filter((value) => Number.isFinite(Number(value)))
                  const commissionLabel = percentages.length ? `${Math.min(...percentages)}–${Math.max(...percentages)}%` : 'Set by admin'
                  return <button key={level} type="button" disabled={!unlocked} onClick={() => { setSelectedLevel(level); setCurrentProjectIndex(0); void navigate({ to: '/residences/', search: { level } }) }} className="group relative flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-[#d8b66b] bg-white text-left shadow-lg shadow-[#071b38]/15 transition duration-300 hover:-translate-y-1 hover:shadow-2xl disabled:cursor-not-allowed disabled:hover:translate-y-0">
                    <div className="relative h-[170px] w-full overflow-hidden">
                      <img src={levelImage} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-full border border-[#f1d28d]/80 bg-[#071b38]/90 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#f1d28d]">{count} {count === 1 ? 'property' : 'properties'}</span>
                    </div>
                    <div className="flex min-h-[78px] items-center gap-4 border-y border-[#d8b66b] bg-[#071b38] px-5 py-4 text-white">
                      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center text-3xl text-[#f1c75b]">{unlocked ? '✺' : '🔒'}</span>
                      <span className="min-w-0"><strong className="display block text-xl">{isTrial ? 'Junior Trial' : level}</strong><span className="mt-1 block text-xs text-[#f1d28d]">{unlocked ? 'Start Your Journey' : 'LEVEL LOCKED'}</span></span>
                    </div>
                    <div className="flex flex-1 flex-col p-5 text-[#071b38]">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9a793b]">Msheireb Properties · Dubai</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e6dfd1] py-3">
                        <div><span className="block text-[9px] uppercase tracking-widest text-[#777]">Starting price</span><strong className="mt-1 block text-sm text-[#071b38]">{startingPrice !== null ? `AED ${startingPrice.toLocaleString('en', { maximumFractionDigits: 2 })}` : 'Set by admin'}</strong></div>
                        <div><span className="block text-[9px] uppercase tracking-widest text-[#777]">Commission</span><strong className="mt-1 block text-sm text-[#071b38]">{commissionLabel}</strong></div>
                      </div>
                      <ul className="mt-4 space-y-2 text-xs text-[#333]">
                        <li className="flex items-center gap-2"><span className="text-[#a98235]">✓</span> Dubai property catalogue</li>
                        <li className="flex items-center gap-2"><span className="text-[#a98235]">✓</span> Admin-managed order settings</li>
                        <li className="flex items-center gap-2"><span className="text-[#a98235]">✓</span> Customer access controls</li>
                      </ul>
                      <span className={`mt-auto flex items-center justify-center gap-2 rounded-xl border px-4 py-3.5 pt-3.5 mt-5 text-center text-xs font-semibold ${unlocked ? 'border-[#d8b66b] bg-gradient-to-r from-[#e7c36e] to-[#d5a844] text-[#071b38]' : 'border-[#d8b66b]/50 bg-[#071b38] text-white'}`}>{unlocked ? 'View Properties  ›' : '🔒  Unlock'}</span>
                    </div>
                  </button>
                })}
                {visibleLevels.length === 0 ? <p className="rounded-lg border border-[#e8e4dc] bg-white p-5 text-sm text-[#777]">No project groups match your search.</p> : null}
              </div>
              </> : null}
              {search.level ? <>
              <div id="project-group-details" className="mt-6 scroll-mt-24 flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow text-brass">Selected group</p><h2 className="display mt-2 text-3xl">{selectedLevel === "Junior Trial" ? "Junior (Trial)" : selectedLevel}</h2></div>

              </div>
              {!currentLevelUnlocked ? <p className="mt-6 border border-border p-5 text-sm text-ink-soft">This level is locked. Contact the administrator to request access.</p> : (
                <>
                  {loadingProjects ? <p className="mt-8 text-sm text-ink-soft">Loading projects…</p> : (
                    <>
                    <div className="mx-auto mt-8 w-full max-w-3xl">
                      {projectCards.slice(currentProjectIndex, currentProjectIndex + 1).map((project, index) => {
                        const cardIndex = currentProjectIndex + index
                        const image = project?.cover_image_url || SAMPLE_IMAGES[cardIndex % SAMPLE_IMAGES.length]
                        return <article key={project?.id || index} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#d8b66b] bg-white shadow-lg shadow-[#071b38]/10">
                          <div className="relative overflow-hidden"><img src={image} alt={project?.name || `Sample project ${cardIndex + 1}`} loading="lazy" className="aspect-[16/9] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" /><span className="eyebrow absolute left-3 top-3 rounded-md border border-[#f1d28d] bg-[#071b38]/90 px-3 py-1.5 text-[0.48rem] text-[#f1d28d]">NO OF PROMOTION {cardIndex + 1}/20</span></div>
                          <div className="flex flex-1 flex-col p-5 sm:p-6"><h3 className="display text-2xl text-[#071b38]">{project?.name || `Sample Project ${String(cardIndex + 1).padStart(2, '0')}`}</h3><p className="mt-2 text-xs text-ink-soft">{project?.location || 'Dubai, UAE'}</p><p className="mt-3 text-sm text-ink-soft">{project?.price_label || 'Sample — price to be set by admin'}</p>{project?.price_amount ? <p className="mt-1 text-sm font-medium">Base price: AED {Number(project.price_amount).toLocaleString('en', { maximumFractionDigits: 2 })}</p> : null}<p className="mt-2 line-clamp-2 text-xs text-ink-soft">{project?.description || 'Sample project card. The administrator can replace the image and all project details.'}</p>{project?.price_amount && project.price_amount > 0 ? <div className="mt-4 grid gap-3 border-t border-border pt-3"><div className="flex items-center justify-between"><span className="eyebrow text-[0.5rem] text-ink-soft">Percentage</span><strong className="text-sm">{project.order_percentages?.[0] ?? 0}%</strong></div><div className="flex items-center justify-between text-xs text-ink-soft"><span>Order amount</span><strong className="text-foreground">AED {Number(project.price_amount).toLocaleString('en', { maximumFractionDigits: 2 })}</strong></div><div className="flex items-center justify-between text-xs text-ink-soft"><span>Commission</span><strong className="text-foreground">AED {(Number(project.price_amount) * Number(project.order_percentages?.[0] ?? 0) / 100).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>{selectedLevel === 'Junior Trial' ? <div className="flex items-center justify-between border-t border-border pt-3 text-xs text-ink-soft"><span>Wallet balance</span><strong className="text-foreground">AED {walletBalanceAed.toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div> : null}<button type="button" disabled={busyProject === project.id || !project.order_percentages?.length || requests.some((request) => request.user_id === currentUserId && request.property_id === project.id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))} onClick={() => void requestProject(project)} className="eyebrow w-full rounded-lg border border-[#d8b66b] bg-[#071b38] px-4 py-3 text-[0.6rem] font-semibold tracking-widest text-[#f1d28d] transition hover:bg-[#10294b] disabled:cursor-not-allowed disabled:opacity-40">{busyProject === project.id ? 'Sending…' : requests.some((request) => request.user_id === currentUserId && request.property_id === project.id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase())) ? 'Already ordered' : 'Order project'}</button></div> : <p className="mt-5 border border-dashed border-border p-3 text-xs text-ink-soft">Awaiting admin price and order settings</p>}</div>
                        </article>
                      })}
                      {projectCards.length === 0 ? <p className="border border-border bg-card p-6 text-sm text-ink-soft sm:col-span-2 xl:col-span-4">No properties are available in this group yet.</p> : null}
                    </div>
                    </>
                  )}
                </>
              )}
              </> : null}
            </div>
          </section>
        )}
        </div>
      </main>

    </div>
  )
}
