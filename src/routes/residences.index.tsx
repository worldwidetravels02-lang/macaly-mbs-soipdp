import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { ListingsGate } from '../components/listings-gate'
import { PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
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
  cover_image_url: string | null
  project_level: string
  set_number: number
  sort_order: number
}
type LevelSetting = { level_name: string; is_unlocked: boolean }
type ProjectRequest = { property_id: string | null; status: string }

export const Route = createFileRoute('/residences/')({
  head: () => {
    const canonical = canonicalUrl('/residences')
    return { meta: [{ title: meta.title }, { name: 'description', content: meta.description }], links: canonical ? [{ rel: 'canonical', href: canonical }] : [] }
  },
  component: ResidencesPage,
})

function ResidencesPage() {
  const [checkingSession, setCheckingSession] = useState(true)
  const [signedIn, setSignedIn] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [levelSettings, setLevelSettings] = useState<LevelSetting[]>([])
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>('Junior Trial')
  const [selectedSet, setSelectedSet] = useState<number>(1)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [busyProject, setBusyProject] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

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
      const [propertyResult, levelResult, requestResult, userResult] = await Promise.all([
        client.from('properties').select('id,slug,name,location,description,price_label,cover_image_url,project_level,set_number,sort_order').eq('status', 'published').not('project_level', 'is', null).order('sort_order', { ascending: true }),
        client.from('project_level_settings').select('level_name,is_unlocked').order('display_order'),
        client.from('investment_requests').select('property_id,status').order('created_at', { ascending: false }),
        client.auth.getUser(),
      ])
      if (propertyResult.error) throw propertyResult.error
      if (levelResult.error) throw levelResult.error
      if (userResult.error) throw userResult.error
      if (requestResult.error) throw requestResult.error
      if (!userResult.data.user) throw new Error('Please sign in to view the project catalogue.')
      if (!active) return
      setProjects((propertyResult.data ?? []) as Project[])
      setLevelSettings((levelResult.data ?? []) as LevelSetting[])
      setRequests((requestResult.data ?? []) as ProjectRequest[])
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the project catalogue.')
    }).finally(() => { if (active) setLoadingProjects(false) })
    return () => { active = false }
  }, [signedIn])

  const currentLevelUnlocked = levelSettings.find((item) => item.level_name === selectedLevel)?.is_unlocked ?? selectedLevel === 'Junior Trial'
  const levelProjects = useMemo(() => projects.filter((project) => project.project_level === selectedLevel), [projects, selectedLevel])
  const selectedSetProjects = useMemo(() => levelProjects.filter((project) => Number(project.set_number) === selectedSet), [levelProjects, selectedSet])
  const completedSets = useMemo(() => {
    const completedIds = new Set(requests.filter((request) => ['funded', 'approved', 'completed'].includes(String(request.status).toLowerCase())).map((request) => request.property_id).filter(Boolean))
    return new Set(SETS.filter((setNo) => {
      const ids = levelProjects.filter((project) => Number(project.set_number) === setNo).map((project) => project.id)
      return ids.length === 20 && ids.every((id) => completedIds.has(id))
    }))
  }, [requests, levelProjects])
  const setIsUnlocked = (setNo: number) => setNo === 1 || (setNo === 2 && completedSets.has(1)) || (setNo === 3 && completedSets.has(2))

  async function requestProject(project: Project) {
    const amountText = project.price_label.replace(/,/g, '').match(/[0-9]+(?:\.[0-9]{1,2})?/)
    const amount = amountText ? Number(amountText[0]) : 0
    if (!amount || !Number.isFinite(amount) || amount <= 0) {
      setError('This sample project is not ready for orders. Ask the administrator to enter and publish its confirmed price first.')
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
        note: 'Project order request submitted from the project catalogue.',
      })
      if (insertError) throw insertError
      setRequests((current) => [...current, { property_id: project.id, status: 'pending' }])
      setNotice('Your project order request has been sent to the administrator for review.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit your project order.')
    } finally { setBusyProject('') }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro eyebrow="Project catalogue" title="Choose your project level." intro="Open a level, choose a set, and browse its 20 project cards in the original order. Sample cards are editable by the administrator; orders remain disabled until a confirmed price is entered." image={IMAGES.tower} imageAlt="Msheireb Properties tower at dusk" />
        {checkingSession ? <p className="mx-auto w-full max-w-7xl px-5 py-16 text-sm text-ink-soft sm:px-8">Checking your session…</p> : !signedIn ? <ListingsGate /> : (
          <section className="py-12 sm:py-16">
            <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
              {error ? <p role="alert" className="mb-5 border border-destructive/40 p-4 text-sm text-destructive">{error}</p> : null}
              {notice ? <p role="status" className="mb-5 border border-brass/40 p-4 text-sm text-ink-soft">{notice}</p> : null}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {LEVELS.map((level) => {
                  const unlocked = levelSettings.find((item) => item.level_name === level)?.is_unlocked ?? level === 'Junior Trial'
                  return <button key={level} type="button" disabled={!unlocked} onClick={() => { setSelectedLevel(level); setSelectedSet(1); setError(''); setNotice('') }} className={`border p-5 text-left transition-colors ${selectedLevel === level ? 'border-brass bg-card' : 'border-border bg-card'} ${!unlocked ? 'cursor-not-allowed opacity-50' : 'hover:border-brass'}`}>
                    <span className="eyebrow text-[0.5rem] text-brass">{unlocked ? 'Available' : 'Locked by admin'}</span>
                    <span className="display mt-2 block text-xl">{level}</span>
                    <span className="mt-2 block text-xs text-ink-soft">{projects.filter((item) => item.project_level === level).length || 60} project slots</span>
                  </button>
                })}
              </div>
              <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
                <div><p className="eyebrow text-brass">Selected level</p><h2 className="display mt-2 text-3xl">{selectedLevel}</h2></div>
                <p className="text-xs text-ink-soft">20 projects in each set · displayed in admin order</p>
              </div>
              {!currentLevelUnlocked ? <p className="mt-6 border border-border p-5 text-sm text-ink-soft">This level is locked. Contact the administrator to request access.</p> : (
                <>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {SETS.map((setNo) => <button key={setNo} type="button" disabled={!setIsUnlocked(setNo)} onClick={() => { setSelectedSet(setNo); setError(''); setNotice('') }} className={`eyebrow border px-5 py-3 text-[0.56rem] ${selectedSet === setNo ? 'border-brass bg-primary text-primary-foreground' : 'border-border'} ${!setIsUnlocked(setNo) ? 'cursor-not-allowed opacity-40' : ''}`}>Set {setNo}{!setIsUnlocked(setNo) ? ' · Locked' : ''}</button>)}
                  </div>
                  {!setIsUnlocked(selectedSet) ? <p className="mt-5 text-sm text-ink-soft">Complete all 20 projects in the previous set before this set opens.</p> : loadingProjects ? <p className="mt-8 text-sm text-ink-soft">Loading projects…</p> : (
                    <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {Array.from({ length: 20 }, (_, index) => {
                        const project = selectedSetProjects[index]
                        const image = project?.cover_image_url || SAMPLE_IMAGES[index % SAMPLE_IMAGES.length]
                        return <article key={project?.id || index} className="group flex h-full flex-col overflow-hidden border border-border bg-card">
                          <div className="relative overflow-hidden"><img src={image} alt={project?.name || `Sample project ${index + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" /><span className="eyebrow absolute left-3 top-3 bg-deep/85 px-3 py-1.5 text-[0.48rem] text-on-deep">Project {String(index + 1).padStart(2, '0')}</span></div>
                          <div className="flex flex-1 flex-col p-4"><h3 className="display text-xl">{project?.name || `Sample Project ${String(index + 1).padStart(2, '0')}`}</h3><p className="mt-2 text-xs text-ink-soft">{project?.location || 'Dubai, UAE'}</p><p className="mt-3 text-sm text-ink-soft">{project?.price_label || 'Sample — price to be set by admin'}</p><p className="mt-2 line-clamp-2 text-xs text-ink-soft">{project?.description || 'Sample project card. The administrator can replace the image and all project details.'}</p><button type="button" disabled={!project || busyProject === project.id || !project.price_label.match(/[0-9]/)} onClick={() => project && void requestProject(project)} className="eyebrow mt-5 w-full bg-primary px-4 py-3 text-[0.55rem] text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40">{busyProject === project?.id ? 'Sending…' : project?.price_label.match(/[0-9]/) ? 'Order project' : 'Awaiting admin price'}</button></div>
                        </article>
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  )
}
