import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { ListingsGate } from '../components/listings-gate'
import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences']
const LEVELS = ['Junior Trial', 'Senior', 'Master', 'Expert'] as const
const SETS = [1, 2, 3] as const
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
  set_number: number
  sort_order: number
}
type ProjectRequest = { property_id: string | null; status: string }

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
  const [checkingSession, setCheckingSession] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [customerLevelAccess, setCustomerLevelAccess] = useState<{ user_id: string; level_name: string; is_unlocked: boolean }[]>([])
  const [customerSetAccess, setCustomerSetAccess] = useState<{ user_id: string; level_name: string; set_number: number; is_unlocked: boolean }[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>(search.level ?? 'Junior Trial')
  const [groupSearch, setGroupSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'trial'>('all')
  const [groupSort, setGroupSort] = useState<'oldest' | 'newest'>('oldest')
  const [currency, setCurrency] = useState('AED')
  const [currentUserName, setCurrentUserName] = useState('Member')
  const [selectedSet, setSelectedSet] = useState<number>(1)
  const [projectSearch, setProjectSearch] = useState('')
  const [projectFilter, setProjectFilter] = useState<'all' | 'available' | 'ordered'>('all')
  const [projectSort, setProjectSort] = useState<'admin' | 'name' | 'price'>('admin')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [busyProject, setBusyProject] = useState('')
  const [orderSelections, setOrderSelections] = useState<Record<string, { quantity: number; percentage: number }>>({})
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (search.level && LEVELS.includes(search.level as typeof LEVELS[number])) {
      setSelectedLevel(search.level)
      setSelectedSet(1)
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
      const [propertyResult, requestResult, userResult, accessResult, setAccessResult] = await Promise.all([
        client.from('properties').select('id,slug,name,location,description,price_label,price_amount,order_percentages,cover_image_url,project_level,set_number,sort_order').eq('status', 'published').not('project_level', 'is', null).order('sort_order', { ascending: true }),
        client.from('investment_requests').select('property_id,status').order('created_at', { ascending: false }),
        client.auth.getUser(),
        client.from('customer_project_level_access').select('user_id,level_name,is_unlocked'),
        client.from('customer_project_set_access').select('user_id,level_name,set_number,is_unlocked'),
      ])
      if (propertyResult.error) throw propertyResult.error
      if (userResult.error) throw userResult.error
      if (requestResult.error) throw requestResult.error
      if (accessResult.error) throw accessResult.error
      if (setAccessResult.error) throw setAccessResult.error
      if (!userResult.data.user) throw new Error('Please sign in to view the project catalogue.')
      if (!active) return
      setProjects((propertyResult.data ?? []) as Project[])
      setRequests((requestResult.data ?? []) as ProjectRequest[])
      setCurrentUserId(userResult.data.user.id)
      setCurrentUserName(String(userResult.data.user.user_metadata?.full_name || userResult.data.user.email?.split('@')[0] || 'Member'))
      setCustomerLevelAccess((accessResult.data ?? []) as { user_id: string; level_name: string; is_unlocked: boolean }[])
      setCustomerSetAccess((setAccessResult.data ?? []) as { user_id: string; level_name: string; set_number: number; is_unlocked: boolean }[])
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the project catalogue.')
    }).finally(() => { if (active) setLoadingProjects(false) })
    return () => { active = false }
  }, [signedIn])

  const currentLevelUnlocked = customerLevelAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel)?.is_unlocked ?? selectedLevel === 'Junior Trial'
  const levelProjects = useMemo(() => projects.filter((project) => project.project_level === selectedLevel), [projects, selectedLevel])
  const selectedSetProjects = useMemo(() => levelProjects.filter((project) => Number(project.set_number) === selectedSet), [levelProjects, selectedSet])
  const visibleProjects = useMemo(() => {
    const query = projectSearch.trim().toLowerCase()
    const rows = selectedSetProjects.filter((project) => {
      const matchesSearch = !query || [project.name, project.location ?? '', project.description ?? ''].some((value) => value.toLowerCase().includes(query))
      const hasOrder = requests.some((request) => request.property_id === project.id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))
      return matchesSearch && (projectFilter === 'all' || (projectFilter === 'ordered' ? hasOrder : !hasOrder))
    })
    if (projectSort === 'name') rows.sort((a, b) => a.name.localeCompare(b.name))
    if (projectSort === 'price') rows.sort((a, b) => Number(a.price_amount ?? 0) - Number(b.price_amount ?? 0))
    return rows
  }, [selectedSetProjects, projectSearch, projectFilter, projectSort, requests])
  const projectCards: (Project | null)[] = projectSearch.trim() || projectFilter !== 'all'
    ? visibleProjects
    : Array.from({ length: 20 }, (_, index) => visibleProjects[index] ?? null)
  const setIsUnlocked = (setNo: number) => customerSetAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel && Number(item.set_number) === setNo)?.is_unlocked ?? (selectedLevel === 'Junior Trial' && setNo === 1)

  async function requestProject(project: Project) {
    const selection = orderSelections[project.id] ?? { quantity: 1, percentage: (project.order_percentages?.[0] ?? 10) }
    const basePrice = Number(project.price_amount || 0)
    const amount = Math.round(basePrice * selection.quantity * selection.percentage) / 100
    if (!basePrice || !Number.isFinite(basePrice) || basePrice <= 0 || !Number.isFinite(amount) || amount <= 0) {
      setError('This project is not ready for orders. Ask the administrator to set its confirmed numeric price first.')
      return
    }
    if (!project.order_percentages?.includes(selection.percentage)) {
      setError('Please choose one of the percentage options enabled by the administrator.')
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
        note: `Project order · Quantity: ${selection.quantity} · Allocation: ${selection.percentage}% · Base price: AED ${basePrice.toFixed(2)} · Total: AED ${amount.toFixed(2)}`, 
      })
      if (insertError) throw insertError
      setRequests((current) => [...current, { property_id: project.id, status: 'pending' }])
      setNotice('Your project order request has been sent to the administrator for review.')
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
    <div className="min-h-screen bg-[#faf9f7] text-[#25231f]">
      <WorkspaceSidebar mode="member" />
      <header className="fixed inset-x-0 top-0 z-40 flex h-[62px] items-center justify-between border-b border-[#e8e4dc] bg-white/95 px-5 pl-20 backdrop-blur lg:left-64 lg:px-7">
        <div className="text-xs text-[#777]"><span>Workspace</span><span className="mx-2">/</span><strong className="text-[#25231f]">Projects</strong></div>
        <div className="flex items-center gap-3 sm:gap-5">
          <label className="flex items-center gap-2 text-[10px] font-semibold tracking-widest text-[#888]">CURRENCY
            <select aria-label="Currency" value={currency} onChange={(event) => setCurrency(event.target.value)} className="rounded-md border border-[#e6e1d8] bg-white px-3 py-2 text-xs font-semibold text-[#172238]"><option>AED</option><option>OMR</option><option>SAR</option><option>KWD</option><option>BHD</option><option>QAR</option></select>
          </label>
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-[#e8e4dc] bg-[#fbfaf8] px-2 py-1.5 text-xs text-[#172238]"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2e9e7] font-semibold">{currentUserName.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{currentUserName.split(" ")[0]}</strong><span className="text-[10px] text-[#888]">User</span></span></Link>
        </div>
      </header>
      <main id="main" className="pb-20 pt-[86px] lg:ml-64">
        <div className="mx-auto w-full max-w-[1500px] px-5 sm:px-7">
        {checkingSession ? <p className="mx-auto w-full max-w-7xl px-5 py-16 text-sm text-ink-soft sm:px-8">Checking your session…</p> : !signedIn ? <ListingsGate /> : (
          <section className="py-12 sm:py-16">
            <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
              {error ? <p role="alert" className="mb-5 border border-destructive/40 p-4 text-sm text-destructive">{error}</p> : null}
              {notice ? <p role="status" className="mb-5 border border-brass/40 p-4 text-sm text-ink-soft">{notice}</p> : null}
              <h1 className="display text-3xl text-[#25231f]">Projects</h1>
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
                  const count = isTrial ? 20 : 60
                  return <button key={level} type="button" disabled={!unlocked} onClick={() => { setSelectedLevel(level); setSelectedSet(1); setError(""); setNotice(""); document.getElementById("project-group-details")?.scrollIntoView({ behavior: "smooth", block: "start" }) }} className="group relative flex min-h-[245px] flex-col justify-end overflow-hidden rounded-xl border border-[#e6e1da] bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed">
                    <img src={levelImage} alt="" className="absolute inset-x-0 top-0 h-[148px] w-full object-cover" />
                    {!unlocked ? <div className="absolute inset-x-0 top-0 h-[148px] bg-[#071426]/30" /> : null}
                    {!unlocked ? <span className="absolute left-1/2 top-[74px] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-[#25231f] shadow">♙</span> : null}
                    <div className="relative mt-[148px] flex flex-1 flex-col bg-white p-4"><span className="text-[10px] font-medium text-[#777]">{count} projects</span><strong className="mt-1 text-sm text-[#25231f]">{isTrial ? "Junior (Trial)" : level}</strong>{!unlocked ? <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-md bg-[#f7efd9] px-3 py-1.5 text-[11px] text-[#806b3c]">♙ Locked</span> : null}</div>
                  </button>
                })}
                {visibleLevels.length === 0 ? <p className="rounded-lg border border-[#e8e4dc] bg-white p-5 text-sm text-[#777]">No project groups match your search.</p> : null}
              </div>
              <div id="project-group-details" className="mt-10 scroll-mt-24 flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow text-brass">Selected group</p><h2 className="display mt-2 text-3xl">{selectedLevel === "Junior Trial" ? "Junior (Trial)" : selectedLevel}</h2></div>
                <p className="text-xs text-ink-soft">20 projects in each set · displayed in admin order</p>
              </div>
              {!currentLevelUnlocked ? <p className="mt-6 border border-border p-5 text-sm text-ink-soft">This level is locked. Contact the administrator to request access.</p> : (
                <>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {SETS.map((setNo) => <button key={setNo} type="button" disabled={!setIsUnlocked(setNo)} onClick={() => { setSelectedSet(setNo); setError(''); setNotice('') }} className={`eyebrow border px-5 py-3 text-[0.56rem] ${selectedSet === setNo ? 'border-brass bg-primary text-primary-foreground' : 'border-border'} ${!setIsUnlocked(setNo) ? 'cursor-not-allowed opacity-40' : ''}`}>Set {setNo}{!setIsUnlocked(setNo) ? ' · Locked' : ''}</button>)}
                  </div>
                  {!setIsUnlocked(selectedSet) ? <p className="mt-5 text-sm text-ink-soft">Complete all 20 projects in the previous set before this set opens.</p> : loadingProjects ? <p className="mt-8 text-sm text-ink-soft">Loading projects…</p> : (
                    <>
                    <div className="mt-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
                      <label className="flex items-center gap-3 border border-border bg-card px-4 py-3">
                        <span className="eyebrow text-[0.5rem] text-ink-soft">Search</span>
                        <input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} type="search" placeholder="Search properties" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
                      </label>
                      <select value={projectFilter} onChange={(event) => setProjectFilter(event.target.value as typeof projectFilter)} aria-label="Filter properties" className="border border-border bg-card px-4 py-3 text-sm">
                        <option value="all">All properties</option>
                        <option value="available">Not ordered</option>
                        <option value="ordered">Ordered</option>
                      </select>
                      <select value={projectSort} onChange={(event) => setProjectSort(event.target.value as typeof projectSort)} aria-label="Sort properties" className="border border-border bg-card px-4 py-3 text-sm">
                        <option value="admin">Admin order</option>
                        <option value="name">Name</option>
                        <option value="price">Price: low to high</option>
                      </select>
                    </div>
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {projectCards.map((project, index) => {
                        const image = project?.cover_image_url || SAMPLE_IMAGES[index % SAMPLE_IMAGES.length]
                        return <article key={project?.id || index} className="group flex h-full flex-col overflow-hidden border border-border bg-card">
                          <div className="relative overflow-hidden"><img src={image} alt={project?.name || `Sample project ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" /><span className="eyebrow absolute left-3 top-3 bg-deep/85 px-3 py-1.5 text-[0.48rem] text-on-deep">Project {String(index + 1).padStart(2, '0')}</span></div>
                          <div className="flex flex-1 flex-col p-4"><h3 className="display text-xl">{project?.name || `Sample Project ${String(index + 1).padStart(2, '0')}`}</h3><p className="mt-2 text-xs text-ink-soft">{project?.location || 'Dubai, UAE'}</p><p className="mt-3 text-sm text-ink-soft">{project?.price_label || 'Sample — price to be set by admin'}</p>{project?.price_amount ? <p className="mt-1 text-sm font-medium">Base price: AED {Number(project.price_amount).toLocaleString('en', { maximumFractionDigits: 2 })}</p> : null}<p className="mt-2 line-clamp-2 text-xs text-ink-soft">{project?.description || 'Sample project card. The administrator can replace the image and all project details.'}</p>{project?.price_amount && project.price_amount > 0 ? <div className="mt-4 grid gap-3 border-t border-border pt-3"><div><span className="eyebrow text-[0.5rem] text-ink-soft">Quantity</span><div className="mt-2 flex items-center gap-3"><button type="button" aria-label="Decrease quantity" disabled={(orderSelections[project.id]?.quantity ?? 1) <= 1} onClick={() => setOrderSelections((current) => ({ ...current, [project.id]: { quantity: Math.max(1, (current[project.id]?.quantity ?? 1) - 1), percentage: current[project.id]?.percentage ?? (project.order_percentages?.[0] ?? 10) } }))} className="border border-border px-3 py-2">−</button><span className="min-w-8 text-center text-sm">{orderSelections[project.id]?.quantity ?? 1}</span><button type="button" aria-label="Increase quantity" disabled={(orderSelections[project.id]?.quantity ?? 1) >= 20} onClick={() => setOrderSelections((current) => ({ ...current, [project.id]: { quantity: Math.min(20, (current[project.id]?.quantity ?? 1) + 1), percentage: current[project.id]?.percentage ?? (project.order_percentages?.[0] ?? 10) } }))} className="border border-border px-3 py-2">+</button></div></div><div><span className="eyebrow text-[0.5rem] text-ink-soft">Select percentage</span><div className="mt-2 flex flex-wrap gap-2">{(project.order_percentages?.length ? project.order_percentages : []).map((percent) => <button key={percent} type="button" onClick={() => setOrderSelections((current) => ({ ...current, [project.id]: { quantity: current[project.id]?.quantity ?? 1, percentage: percent } }))} className={`border px-3 py-2 text-xs ${(orderSelections[project.id]?.percentage ?? (project.order_percentages?.[0] ?? 10)) === percent ? 'border-brass bg-brass/10' : 'border-border'}`}>{percent}%</button>)}</div></div><p className="text-xs text-ink-soft">Order total: <strong className="text-foreground">AED {(Number(project.price_amount) * (orderSelections[project.id]?.quantity ?? 1) * (orderSelections[project.id]?.percentage ?? (project.order_percentages?.[0] ?? 10)) / 100).toLocaleString('en', { maximumFractionDigits: 2 })}</strong></p><button type="button" disabled={busyProject === project.id || !project.order_percentages?.length} onClick={() => void requestProject(project)} className="eyebrow w-full bg-primary px-4 py-3 text-[0.55rem] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{busyProject === project.id ? 'Sending…' : 'Order project'}</button></div> : <p className="mt-5 border border-dashed border-border p-3 text-xs text-ink-soft">Awaiting admin price and order settings</p>}</div>
                        </article>
                      })}
                      {projectCards.length === 0 ? <p className="border border-border bg-card p-6 text-sm text-ink-soft sm:col-span-2 xl:col-span-4">No properties match these filters. Try another search or choose All properties.</p> : null}
                    </div>
                    </>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </main>

    </div>
  )
}
