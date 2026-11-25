import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  set_number: number
  sort_order: number
}
type ProjectRequest = { user_id: string; property_id: string | null; status: string }
type CustomerBadgeAccess = { user_id: string; level_name: string; set_number: number; is_unlocked: boolean; progress_percent?: number }

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
  const [customerSetAccess, setCustomerSetAccess] = useState<CustomerBadgeAccess[]>([])
  const [selectedSet, setSelectedSet] = useState(1)
  const [currentUserId, setCurrentUserId] = useState('')
  const [requests, setRequests] = useState<ProjectRequest[]>([])
  const [completionDismissals, setCompletionDismissals] = useState<string[]>([])
  const [selectedLevel, setSelectedLevel] = useState<string>(search.level ?? 'Junior Trial')
  const [groupSearch, setGroupSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<'all' | 'trial'>('all')
  const [groupSort, setGroupSort] = useState<'oldest' | 'newest'>('oldest')
  const [currentUserName, setCurrentUserName] = useState('Member')
  const [currentProjectIndex, setCurrentProjectIndex] = useState(0)
  const [trialBonusBalanceOmr, setTrialBonusBalanceOmr] = useState(0)
  const [welcomeBonus, setWelcomeBonus] = useState<{ id: string; amount: number | string; currency: string; popup_seen_at: string | null } | null>(null)
  const [walletBalanceOmr, setWalletBalanceOmr] = useState(0)
  const [fortuneAssignments, setFortuneAssignments] = useState<any[]>([])
  const [premiumAssignments, setPremiumAssignments] = useState<any[]>([])
  const [activePremiumPopup, setActivePremiumPopup] = useState<any | null>(null)
  const [fortuneRewards, setFortuneRewards] = useState<any[]>([])
  const [fortuneReveal, setFortuneReveal] = useState<number | null>(null)
  const [fortuneBusy, setFortuneBusy] = useState(false)
  const completionShownRef = useRef('')
  const [projectSort, setProjectSort] = useState<'admin' | 'name' | 'price'>('admin')
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [busyProject, setBusyProject] = useState('')
  const [notice, setNotice] = useState('')
  const [successPopup, setSuccessPopup] = useState(false)
  const [orderSuccessPopup, setOrderSuccessPopup] = useState(false)
  const [orderedProjectName, setOrderedProjectName] = useState('')
  const [completedLevel, setCompletedLevel] = useState('')
  const [error, setError] = useState('')

  const displayMoney = (value: number | string, from: string = 'OMR') => from === 'OMR' ? new Intl.NumberFormat('en', { style: 'currency', currency: 'OMR', maximumFractionDigits: 2 }).format(Number(value) || 0) : 'Legacy non-OMR amount (not converted)'

  useEffect(() => {
    if (search.level && LEVELS.includes(search.level as typeof LEVELS[number])) {
      setSelectedLevel(search.level)
      setCurrentProjectIndex(0)
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
      const [propertyResult, userResult, accessResult, setAccessResult] = await Promise.all([
        client.from('properties').select('id,slug,name,location,description,price_label,price_amount,order_percentages,cover_image_url,project_level,set_number,sort_order').eq('status', 'published').not('project_level', 'is', null).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        client.auth.getUser(),
        client.from('customer_project_level_access').select('user_id,level_name,is_unlocked'),
        client.from('customer_project_set_access').select('user_id,level_name,set_number,is_unlocked'),
      ])
      if (propertyResult.error) throw propertyResult.error
      if (userResult.error) throw userResult.error
      if (accessResult.error) throw accessResult.error
      if (setAccessResult.error) throw setAccessResult.error
      if (!userResult.data.user) throw new Error('Please sign in to view the project catalogue.')
      const { error: bonusEnsureError } = await client.rpc('ensure_member_trial_bonus')
      if (bonusEnsureError) console.warn('Welcome Trial Bonus is not available:', bonusEnsureError.message)
      const [requestResult, walletResult, trialBonusResult, fortuneResult, fortuneRewardResult, premiumResult, completionDismissalResult] = await Promise.all([
        client.from('investment_requests').select('user_id,property_id,status').eq('user_id', userResult.data.user.id).order('created_at', { ascending: false }),
        client.from('wallet_balances').select('balance').eq('user_id', userResult.data.user.id).eq('currency', 'OMR').maybeSingle(),
        // Trial Bonus is optional for catalogue rendering. A missing or unavailable
        // bonus table must not prevent the published property list from loading.
        client.from('trial_bonus_transactions').select('id,direction,amount,currency,popup_seen_at,reference_type').eq('user_id', userResult.data.user.id),
        client.from('fortune_box_assignments').select('id,level_name,badge_number,position,rewards,status').eq('user_id', userResult.data.user.id).eq('status', 'active'),
        client.from('fortune_reward_transactions').select('id,amount,currency,description,created_at').eq('user_id', userResult.data.user.id).order('created_at', { ascending: false }).limit(30),
        client.from('premium_project_assignments').select('id,level_name,badge_number,position,project_name,deposit_amount,commission_percent,status').eq('user_id', userResult.data.user.id).eq('status', 'active'),
        client.from('member_project_completion_dismissals').select('level_name,set_number').eq('user_id', userResult.data.user.id),
      ])
      if (requestResult.error) throw requestResult.error
      if (walletResult.error) throw walletResult.error
      if (completionDismissalResult.error) throw completionDismissalResult.error
      if (!active) return
      setProjects((propertyResult.data ?? []) as Project[])
      setRequests((requestResult.data ?? []) as ProjectRequest[])
      setCompletionDismissals((completionDismissalResult.data ?? []).map((row) => `${row.level_name}:${row.set_number}`))
      setCurrentUserId(userResult.data.user.id)
      setCurrentUserName(String(userResult.data.user.user_metadata?.full_name || userResult.data.user.email?.split('@')[0] || 'Member'))
      setCustomerLevelAccess((accessResult.data ?? []) as { user_id: string; level_name: string; is_unlocked: boolean }[])
      setCustomerSetAccess((setAccessResult.data ?? []) as CustomerBadgeAccess[])
      const trialBonusBalance = trialBonusResult.error ? 0 : (trialBonusResult.data ?? []).filter((entry) => entry.currency === 'OMR').reduce((total, entry) => total + (entry.direction === 'credit' ? 1 : -1) * Number(entry.amount || 0), 0)
      setTrialBonusBalanceOmr(Math.max(0, trialBonusBalance))
      const welcomeRow = trialBonusResult.error ? null : (trialBonusResult.data ?? []).find((entry) => entry.reference_type === 'welcome_trial_bonus')
      setWelcomeBonus(welcomeRow ? { id: welcomeRow.id, amount: welcomeRow.amount, currency: welcomeRow.currency, popup_seen_at: welcomeRow.popup_seen_at } : null)
      setWalletBalanceOmr(Number(walletResult.data?.balance ?? 0))
      if (!fortuneResult.error) setFortuneAssignments(fortuneResult.data ?? [])
      if (!premiumResult.error) setPremiumAssignments(premiumResult.data ?? [])
      if (!fortuneRewardResult.error) setFortuneRewards(fortuneRewardResult.data ?? [])
    })().catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Could not load the project catalogue.')
    }).finally(() => { if (active) setLoadingProjects(false) })
    return () => { active = false }
  }, [signedIn])

  const dismissWelcomeBonus = async () => {
    try {
      const client = requireSupabase()
      const { error: dismissError } = await client.rpc('dismiss_member_trial_bonus_popup')
      if (dismissError) throw dismissError
      setWelcomeBonus((current) => current ? { ...current, popup_seen_at: new Date().toISOString() } : null)
    } catch (cause) { console.error('Could not save the welcome bonus popup status:', cause) }
  }
  useEffect(() => {
    if (!welcomeBonus || welcomeBonus.popup_seen_at) return
    const timeout = window.setTimeout(() => { void dismissWelcomeBonus() }, 5000)
    return () => window.clearTimeout(timeout)
  }, [welcomeBonus])

  useEffect(() => {
    if (selectedLevel === 'Junior Trial') return
    const badges = [1, 2, 3].map((setNumber) => {
      const access = customerSetAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel && item.set_number === setNumber)
      const unlocked = access?.is_unlocked ?? setNumber === 1
      const propertyIds = new Set(projects.filter((project) => project.project_level === selectedLevel && Number(project.set_number) === setNumber).map((project) => project.id))
      const orderedCount = new Set(requests.filter((request) => request.user_id === currentUserId && request.property_id && propertyIds.has(request.property_id) && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase())).map((request) => request.property_id)).size
      return { setNumber, unlocked, orderedCount }
    })
    const nextBadge = badges.find((badge) => badge.unlocked && badge.orderedCount < 20) ?? badges.find((badge) => badge.unlocked)
    if (nextBadge && selectedSet !== nextBadge.setNumber) setSelectedSet(nextBadge.setNumber)
  }, [selectedLevel, selectedSet, customerSetAccess, projects, requests, currentUserId])

  const currentLevelUnlocked = (customerLevelAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel)?.is_unlocked ?? false) && (selectedLevel === 'Junior Trial' || (customerSetAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel && item.set_number === selectedSet)?.is_unlocked ?? selectedSet === 1))
  const levelProjects = useMemo(() => {
    const matching = projects.filter((project) => project.project_level === selectedLevel && (selectedLevel === 'Junior Trial' ? Number(project.set_number) === 1 : Number(project.set_number) === selectedSet))
    // Keep Junior Trial to 20 properties, in the original database-returned order.
    return selectedLevel === 'Junior Trial' ? matching.slice(0, 20) : matching
  }, [projects, selectedLevel, selectedSet])
  const visibleProjects = useMemo(() => {
    // Property progression must follow the admin-configured sequence, never name/price sorting.
    return [...levelProjects].sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0) || a.name.localeCompare(b.name))
  }, [levelProjects])
  const orderedPropertyIds = useMemo(() => new Set(requests
    .filter((request) => request.user_id === currentUserId && request.property_id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))
    .filter((request) => levelProjects.some((project) => project.id === request.property_id))
    .map((request) => request.property_id)), [requests, currentUserId, levelProjects])
  const fundedPropertyIds = useMemo(() => new Set(requests
    .filter((request) => request.user_id === currentUserId && request.property_id && String(request.status).toLowerCase() === 'funded')
    .filter((request) => levelProjects.some((project) => project.id === request.property_id))
    .map((request) => request.property_id)), [requests, currentUserId, levelProjects])
  const currentProgressPercent = selectedLevel === 'Junior Trial'
    ? Math.max(0, Math.min(100, fundedPropertyIds.size / 20 * 100))
    : Math.max(0, Math.min(100, Number(customerSetAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel && item.set_number === selectedSet)?.progress_percent ?? 0)))
  const remainingProjects = useMemo(() => visibleProjects.filter((project) => !orderedPropertyIds.has(project.id)), [visibleProjects, orderedPropertyIds])
  // Show only the next un-ordered property in the progression, never the full remaining catalogue.
  const projectCards: Project[] = remainingProjects.slice(0, 1)
  useEffect(() => {
    setCurrentProjectIndex(Math.min(orderedPropertyIds.size, 20))
  }, [orderedPropertyIds])

  useEffect(() => {
    const completionKey = `${selectedLevel}:${selectedSet}`
    if (orderedPropertyIds.size < 20 || completionDismissals.includes(completionKey) || completionShownRef.current === completionKey) return
    completionShownRef.current = completionKey
    setCompletedLevel(selectedLevel)
    const nextStep = selectedSet < 3
      ? `Badge ${selectedSet + 1}`
      : selectedLevel === 'Senior'
        ? 'Master Level'
        : selectedLevel === 'Master'
          ? 'Expert Level'
          : 'the next step'
    setNotice(selectedLevel === 'Junior Trial'
      ? 'Congratulations! You have achieved the Junior Trial Project. Contact Customer Support to request Senior Level access.'
      : `Congratulations! You have completed ${selectedLevel} Badge ${selectedSet}. Contact Customer Support to request ${nextStep} unlock.`)
    setSuccessPopup(true)
  }, [orderedPropertyIds, selectedLevel, selectedSet, completionDismissals])

  async function dismissCompletionPopup() {
    const key = `${completedLevel}:${selectedSet}`
    try {
      const { error: dismissError } = await requireSupabase().rpc('dismiss_member_project_completion_popup', { p_level_name: completedLevel, p_set_number: selectedSet })
      if (dismissError) throw dismissError
      setCompletionDismissals((current) => current.includes(key) ? current : [...current, key])
      setSuccessPopup(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the completion message status. Please try again.')
    }
  }

  async function requestProject(project: Project) {
    const premiumAssignment = selectedLevel === 'Junior Trial' ? null : premiumAssignments.find((item) => item.level_name === selectedLevel && Number(item.badge_number) === selectedSet && Number(item.position) === currentProjectIndex + 1 && item.status === 'active')
    if (premiumAssignment) {
      setPremiumAssignments((current) => current.filter((item) => item.id !== premiumAssignment.id))
      setActivePremiumPopup(premiumAssignment)
      return
    }
    const selection = { quantity: 1, percentage: Number(project.order_percentages?.[0] ?? 0) }
    const basePrice = Number(project.price_amount || 0)
    const amount = Math.round(basePrice * selection.quantity * 100) / 100
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
      const { error: orderError } = await client.rpc('member_submit_project_order', { p_property_id: project.id })
      if (orderError) throw orderError
      const updatedRequests = [...requests, { user_id: currentUserId, property_id: project.id, status: 'pending' }]
      setRequests(updatedRequests)
      const orderedPropertyIds = new Set(updatedRequests
        .filter((request) => request.user_id === currentUserId && request.property_id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))
        .filter((request) => projects.some((item) => item.id === request.property_id && item.project_level === selectedLevel && (selectedLevel === 'Junior Trial' || Number(item.set_number) === selectedSet)))
        .map((request) => request.property_id))
      setCurrentProjectIndex(Math.min(orderedPropertyIds.size, 20))
      setOrderedProjectName(project.name)
      setNotice('Your order request has been submitted. Opening the next property…')
      if (orderedPropertyIds.size < 20) setOrderSuccessPopup(true)
    } catch (cause) {
      const details = cause && typeof cause === 'object' ? cause as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown } : null
      const message = cause instanceof Error ? cause.message : typeof details?.message === 'string' ? details.message : typeof details?.details === 'string' ? details.details : typeof details?.hint === 'string' ? details.hint : null
      console.error('Project order submission failed:', cause)
      setError(message || (typeof details?.code === 'string' ? `Project order failed (${details.code}).` : 'Could not submit your project order. Check the browser console for details.'))
    } finally { setBusyProject('') }
  }

  const activeFortuneAssignment = selectedLevel === 'Junior Trial' ? null : fortuneAssignments.find((item) => item.level_name === selectedLevel && Number(item.badge_number) === selectedSet && Number(item.position) === currentProjectIndex + 1)

  const claimFortuneCard = async (cardNumber: number) => {
    if (!activeFortuneAssignment || fortuneBusy) return
    setFortuneBusy(true); setError('')
    try {
      const { data, error: claimError } = await requireSupabase().rpc('claim_fortune_box', { p_assignment_id: activeFortuneAssignment.id, p_card_number: cardNumber })
      if (claimError) throw claimError
      const reward = Array.isArray(data) ? data[0] : data
      setFortuneReveal(Number(reward?.amount ?? 0))
      setFortuneAssignments((current) => current.filter((item) => item.id !== activeFortuneAssignment.id))
      setFortuneRewards((current) => [{ id: reward?.id, amount: reward?.amount, currency: 'OMR', description: 'Fortune Box reward credit', created_at: new Date().toISOString() }, ...current])
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not claim this reward.') }
    finally { setFortuneBusy(false) }
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
          <Link to="/account" className="flex items-center gap-2 rounded-xl border border-[#c9a45c]/50 bg-[#10294b] px-2 py-1.5 text-xs text-white"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d8b66b] font-semibold text-[#071b38]">{currentUserName.slice(0,1).toUpperCase()}</span><span className="hidden text-left sm:block"><strong className="block">{currentUserName.split(" ")[0]}</strong><span className="text-[10px] text-[#888]">User</span></span></Link>
        </div>
      </header>
      {welcomeBonus && !welcomeBonus.popup_seen_at ? <div role="presentation" className="fixed inset-0 z-[110] flex items-center justify-center bg-[#071b38]/80 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="residences-trial-bonus-title" className="relative w-full max-w-md rounded-3xl border-2 border-[#d8b66b] bg-[#071b38] p-7 text-center text-white shadow-2xl"><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#d8b66b] text-3xl text-[#f1d28d]">✦</div><p className="eyebrow mt-5 text-xs tracking-[0.25em] text-[#f1d28d]">A WELCOME GIFT</p><h2 id="residences-trial-bonus-title" className="display mt-2 text-3xl">Your Trial Bonus</h2><p className="mt-3 text-sm text-white/75">Your welcome bonus has been credited automatically.</p><div className="my-5 rounded-2xl bg-[#f4e6bf] p-5 text-[#071b38]"><p className="text-xs font-bold tracking-widest">WELCOME CREDIT</p><p className="mt-2 text-4xl font-bold">{displayMoney(Number(welcomeBonus.amount), 'OMR')}</p><p className="mt-1 text-xs">Trial Bonus Wallet</p></div><p className="text-xs text-white/70">This bonus is credited once only. Claiming does not add another credit.</p><button type="button" onClick={() => void dismissWelcomeBonus()} className="mt-5 w-full rounded-xl bg-[#e1c477] px-6 py-4 text-sm font-bold text-[#071b38]">Claim Bonus</button><button type="button" onClick={() => void dismissWelcomeBonus()} className="mt-3 px-4 py-2 text-xs text-white/70 underline">Dismiss</button></section></div> : null}
      {activePremiumPopup ? <div className="fixed inset-0 z-[125] flex items-center justify-center bg-[#071b38]/90 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="premium-project-title" className="w-full max-w-lg rounded-3xl border-2 border-[#d8b66b] bg-[#071b38] p-7 text-center text-white shadow-2xl"><p className="eyebrow text-[#f1d28d]">SPECIAL ASSIGNMENT · PREMIUM PROJECT</p><h2 id="premium-project-title" className="display mt-3 text-3xl">Congratulations!</h2><p className="mt-3 text-sm text-white/75">You have reached a project position with a special Premium Project assignment.</p><div className="my-6 rounded-2xl border border-[#d8b66b]/70 bg-[#10294b] p-5 text-left"><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#f1d28d]">Assigned project</p><h3 className="display mt-2 text-2xl text-white">{activePremiumPopup.project_name}</h3><div className="mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-4 text-sm"><span className="text-white/70">Required deposit</span><strong className="text-[#f1d28d]">{displayMoney(Number(activePremiumPopup.deposit_amount), 'OMR')}</strong></div><div className="mt-3 flex items-center justify-between gap-3 text-sm"><span className="text-white/70">Commission</span><strong className="text-[#f1d28d]">{Number(activePremiumPopup.commission_percent).toFixed(2)}%</strong></div><p className="mt-4 text-[10px] text-white/55">{activePremiumPopup.level_name} · Badge {activePremiumPopup.badge_number} · Property {activePremiumPopup.position}</p></div><p className="text-xs leading-5 text-white/65">Please contact Customer Support for deposit instructions and verification. This property order has not been submitted yet.</p><Link to="/support" className="mt-6 block w-full rounded-xl bg-[#e1c477] px-6 py-4 text-sm font-bold text-[#071b38]">Contact Customer Support</Link><button type="button" onClick={() => setActivePremiumPopup(null)} className="mt-4 px-4 py-2 text-xs text-white/70 underline">Close</button></section></div> : null}
      {activeFortuneAssignment ? <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#071b38]/85 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" className="w-full max-w-xl rounded-3xl border-2 border-[#d8b66b] bg-[#071b38] p-7 text-center text-white shadow-2xl"><p className="eyebrow text-[#f1d28d]">SPECIAL REWARD</p><h2 className="display mt-2 text-3xl">Fortune Box</h2><p className="mt-3 text-sm text-white/75">Choose one card to reveal your reward.</p><div className="mt-7 grid grid-cols-3 gap-3">{[1,2,3].map((card) => <button key={card} type="button" disabled={fortuneBusy} onClick={() => void claimFortuneCard(card)} className="aspect-[3/4] rounded-2xl border-2 border-[#d8b66b] bg-gradient-to-br from-[#f3d98f] to-[#6f4b1d] text-[#071b38] shadow-lg transition duration-300 hover:-translate-y-2 disabled:opacity-60"><span className="block text-4xl">✦</span><strong className="mt-3 block text-xs tracking-widest">CARD {card}</strong></button>)}</div><p className="mt-5 text-[10px] text-white/60">Promotional reward credits are not withdrawable or exchangeable for cash.</p>{fortuneBusy ? <p className="mt-3 text-sm text-[#f1d28d]">Revealing…</p> : null}</section></div> : null}
      {fortuneReveal !== null ? <div className="fixed inset-0 z-[121] flex items-center justify-center bg-[#071b38]/85 p-4"><section role="dialog" aria-modal="true" className="w-full max-w-md rounded-3xl border-2 border-[#d8b66b] bg-[#071b38] p-8 text-center text-white"><p className="eyebrow text-[#f1d28d]">REWARD REVEALED</p><h2 className="display mt-2 text-3xl">Congratulations!</h2><p className="mt-3 text-sm text-white/70">Your reward credit has been recorded.</p><p className="my-6 text-4xl font-bold text-[#f1d28d]">{fortuneReveal.toFixed(2)} credits</p><button type="button" onClick={() => setFortuneReveal(null)} className="w-full rounded-xl bg-[#e1c477] px-6 py-4 text-sm font-bold text-[#071b38]">Continue</button></section></div> : null}
      {orderSuccessPopup ? <div role="presentation" className="fixed inset-0 z-[130] flex items-center justify-center bg-[#071b38]/80 p-5 backdrop-blur-sm">
        <section role="dialog" aria-modal="true" aria-labelledby="order-success-title" className="w-full max-w-md rounded-3xl border-2 border-[#d8b66b] bg-white p-8 text-center shadow-2xl animate-[orderPop_.55s_cubic-bezier(.2,.8,.2,1)]">
          <div aria-hidden="true" className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border-2 border-[#d8b66b] bg-gradient-to-br from-[#fff7df] to-[#e8d39a] text-5xl text-[#23834b]">✓</div>
          <p className="eyebrow text-xs font-bold tracking-[0.24em] text-[#9a793b]">PROPERTY ORDER</p>
          <h2 id="order-success-title" className="display mt-3 text-3xl text-[#071b38]">Order successful</h2>
          <p className="mt-4 text-sm leading-6 text-[#555]">Your order request for <strong>{orderedProjectName}</strong> has been submitted successfully.</p>
          <p className="mt-3 text-xs text-[#777]">Opening the next property…</p>
          <button type="button" onClick={() => setOrderSuccessPopup(false)} className="mt-6 w-full rounded-xl bg-[#071b38] px-6 py-4 text-sm font-semibold text-[#f1d28d]">Continue</button>
        </section>
      </div> : null}
      {successPopup ? <div role="presentation" className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#071b38]/75 px-5 py-8 backdrop-blur-md">
        {completedLevel === 'Junior Trial' ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">{Array.from({ length: 28 }, (_, index) => <span key={index} className="absolute -top-4 h-3 w-2 animate-[juniorConfetti_2.8s_ease-in_forwards]" style={{ left: `${(index * 37) % 100}%`, animationDelay: `${(index % 7) * 0.13}s`, animationDuration: `${2.2 + (index % 4) * 0.35}s`, backgroundColor: ['#e6c477', '#fff1c6', '#d8b66b', '#ffffff', '#b9d6c5'][index % 5], borderRadius: index % 2 ? '999px' : '2px' }} />)}</div> : null}
        <section role="dialog" aria-modal="true" aria-labelledby="project-completion-title" className="relative w-full max-w-xl overflow-hidden rounded-3xl border-2 border-[#d8b66b] bg-white p-7 text-center shadow-[0_24px_90px_rgba(0,0,0,.4)] animate-[orderPop_.55s_cubic-bezier(.2,.8,.2,1)] sm:p-9">
          {completedLevel === 'Junior Trial' ? <>
            <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full border border-[#d8b66b]/40 bg-[#f4e6bf]/30 animate-[juniorGlow_3s_ease-in-out_infinite]" />
            <div className="relative mx-auto mb-5 grid h-24 w-24 place-items-center rounded-full border-2 border-[#d8b66b] bg-gradient-to-br from-[#fff7df] to-[#e8d39a] text-6xl shadow-[0_0_35px_rgba(216,182,107,.45)] animate-[juniorCelebrate_.8s_ease-out_both]">🏆</div>
            <p className="eyebrow text-[0.58rem] font-bold tracking-[0.28em] text-[#9a793b]">JUNIOR TRIAL · COMPLETE</p>
            <h2 id="project-completion-title" className="display mt-3 text-3xl text-[#071b38] sm:text-4xl">Congratulations!</h2>
            <p className="mt-4 text-base leading-7 text-[#555]">You have achieved the Junior Trial Project by completing all 20 properties.</p>
            <div className="my-6 rounded-2xl border border-[#d8b66b]/70 bg-gradient-to-r from-[#fff8e6] via-[#f4e6bf] to-[#fff8e6] px-5 py-4">
              <p className="text-sm font-bold tracking-[0.16em] text-[#765b25]">20 / 20 PROJECTS COMPLETED</p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#e4d7b6]"><div className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#b58b3c] to-[#e6c477] animate-[juniorProgress_.9s_ease-out_both]" /></div>
            </div>
            <h3 className="display text-2xl text-[#071b38]">Next: Senior Level</h3>
            <p className="mt-2 text-sm leading-6 text-[#666]">Contact Customer Support to request your Senior Level unlock and continue your journey.</p>
            <Link to="/support" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#071b38] px-6 py-4 text-sm font-semibold text-[#f1d28d] shadow-lg transition hover:bg-[#12345b]">Contact Customer Support <span aria-hidden="true" className="ml-2">→</span></Link>
          </> : <>
            <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-[#e8f5ec] text-5xl font-bold text-[#23834b]">🎉</div>
            <h2 id="project-completion-title" className="display text-3xl text-[#071b38]">Congratulations!</h2>
            <p className="mt-4 text-base leading-7 text-[#666]">{notice}</p>
            <p className="mt-5 text-sm font-semibold tracking-wide text-[#9a793b]">BADGE {selectedSet} · 20 / 20 PROPERTIES COMPLETED</p>
            <Link to="/support" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#071b38] px-6 py-4 text-sm font-semibold text-[#f1d28d]">Contact Customer Support</Link>
          </>}
          <button type="button" onClick={() => void dismissCompletionPopup()} className="mt-5 text-xs font-semibold text-[#666] underline underline-offset-4">Close</button>
        </section>
        <style>{'@keyframes orderPop { 0% { opacity: 0; transform: scale(.82) translateY(18px); } 100% { opacity: 1; transform: scale(1) translateY(0); } } @keyframes juniorConfetti { 0% { transform: translate3d(0,-5vh,0) rotate(0deg); opacity: 0; } 12% { opacity: 1; } 100% { transform: translate3d(35px,110vh,0) rotate(720deg); opacity: 0; } } @keyframes juniorCelebrate { 0% { opacity: 0; transform: scale(.35) rotate(-25deg); } 65% { opacity: 1; transform: scale(1.12) rotate(8deg); } 100% { transform: scale(1) rotate(0); } } @keyframes juniorGlow { 0%,100% { transform: scale(.92); opacity: .5; } 50% { transform: scale(1.12); opacity: 1; } } @keyframes juniorProgress { from { transform: scaleX(0); } to { transform: scaleX(1); } } @media (prefers-reduced-motion: reduce) { .animate-\\[juniorConfetti_2\\.8s_ease-in_forwards\\], .animate-\\[juniorGlow_3s_ease-in-out_infinite\\], .animate-\\[juniorCelebrate_\\.8s_ease-out_both\\], .animate-\\[juniorProgress_\\.9s_ease-out_both\\], .animate-\\[orderPop_\\.55s_cubic-bezier\\(\\.2\\,\\.8\\,\\.2\\,1\\)\\] { animation: none !important; } }'}</style>
      </div> : null}
      
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
                  const unlocked = level === 'Junior Trial' || (customerLevelAccess.find((item) => item.user_id === currentUserId && item.level_name === level)?.is_unlocked ?? false)
                  const isTrial = level === 'Junior Trial'
                  const levelImage = isTrial ? IMAGES.marinaNight : level === "Senior" ? IMAGES.tower : level === "Master" ? IMAGES.detail : IMAGES.villas
                  const levelProperties = projects.filter((project) => project.project_level === level && (!isTrial || Number(project.set_number) === 1))
                  const count = levelProperties.length
                  const prices = levelProperties.map((project) => Number(project.price_amount)).filter((price) => Number.isFinite(price) && price > 0)
                  const startingPrice = prices.length ? Math.min(...prices) : null
                  const percentages = levelProperties.flatMap((project) => project.order_percentages ?? []).filter((value) => Number.isFinite(Number(value)))
                  const commissionLabel = percentages.length ? `${Math.min(...percentages)}–${Math.max(...percentages)}%` : 'Set by admin'
                  return <button key={level} type="button" disabled={!unlocked} onClick={() => { setSelectedLevel(level); setSelectedSet(1); setCurrentProjectIndex(0); void navigate({ to: '/residences/', search: { level } }) }} className="group relative flex min-h-[500px] flex-col overflow-hidden rounded-2xl border border-[#d8b66b] bg-white text-left shadow-lg shadow-[#071b38]/15 transition duration-300 hover:-translate-y-1 hover:shadow-2xl disabled:cursor-not-allowed disabled:hover:translate-y-0">
                    <div className="relative h-[170px] w-full overflow-hidden">
                      <img src={levelImage} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <span className="absolute left-3 top-3 rounded-full border border-[#f1d28d]/80 bg-[#071b38]/90 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#f1d28d]">{count} {count === 1 ? 'property' : 'properties'}</span>
                    </div>
                    <div className="flex min-h-[78px] items-center gap-4 border-y border-[#d8b66b] bg-[#071b38] px-5 py-4 text-white">
                      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center text-3xl text-[#f1c75b]">{unlocked ? '✺' : '🔒'}</span>
                      <span className="min-w-0"><strong className="display block text-xl">{isTrial ? 'Junior Trial' : level}</strong><span className="mt-1 block text-xs text-[#f1d28d]">{unlocked ? 'Start Your Journey' : 'LEVEL LOCKED'}</span></span>
                    </div>
                    <div className="flex flex-1 flex-col p-5 text-[#071b38]">
                      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-[#9a793b]">Msheireb Properties · Muscat, Oman</p>
                      <div className="mt-4 grid grid-cols-2 gap-3 border-y border-[#e6dfd1] py-3">
                        <div><span className="block text-[9px] uppercase tracking-widest text-[#777]">Starting price</span><strong className="mt-1 block text-sm text-[#071b38]">{startingPrice !== null ? displayMoney(startingPrice) : 'Set by admin'}</strong></div>
                        <div><span className="block text-[9px] uppercase tracking-widest text-[#777]">Commission</span><strong className="mt-1 block text-sm text-[#071b38]">{commissionLabel}</strong></div>
                      </div>
                      <ul className="mt-4 space-y-2 text-xs text-[#333]">
                        <li className="flex items-center gap-2"><span className="text-[#a98235]">✓</span> Oman property catalogue</li>
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
                <div><p className="eyebrow text-brass">{selectedLevel === 'Junior Trial' ? 'Single progression' : 'Selected level'}</p><h2 className="display mt-2 text-3xl">{selectedLevel === "Junior Trial" ? "Junior (Trial)" : selectedLevel}</h2></div>

              </div>
              {selectedLevel !== 'Junior Trial' ? <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Badge progress">{[1, 2, 3].map((setNumber) => {
                const access = customerSetAccess.find((item) => item.user_id === currentUserId && item.level_name === selectedLevel && item.set_number === setNumber)
                const unlocked = access?.is_unlocked ?? setNumber === 1
                const setPropertyIds = new Set(projects.filter((project) => project.project_level === selectedLevel && Number(project.set_number) === setNumber).map((project) => project.id))
                const completed = new Set(requests.filter((request) => request.user_id === currentUserId && request.property_id && setPropertyIds.has(request.property_id) && String(request.status).toLowerCase() === 'funded').map((request) => request.property_id)).size
                return <div key={setNumber} aria-current={selectedSet === setNumber ? 'step' : undefined} className={`rounded-xl border-2 p-4 text-left ${selectedSet === setNumber ? 'border-[#d8b66b] bg-[#071b38] text-white' : 'border-[#d8b66b]/50 bg-white text-[#071b38]'}`}><span className="flex items-center justify-between"><strong className="display text-lg">Badge {setNumber}</strong><span>{unlocked ? '🏅' : '•'}</span></span><span className={`mt-2 block text-xs ${selectedSet === setNumber ? 'text-white/75' : 'text-ink-soft'}`}>{Math.max(0, Math.min(100, Number(access?.progress_percent ?? 0)))}% admin-set progress · {completed} / 20 funded</span><span className={`mt-1 block text-[10px] font-semibold uppercase tracking-widest ${selectedSet === setNumber ? 'text-[#f1d28d]' : 'text-[#9a793b]'}`}>{selectedSet === setNumber ? 'Current badge' : unlocked ? 'Unlocked' : 'Not yet available'}</span></div>
              })}</div> : null}
              {fortuneRewards.length ? <section className="mx-auto mt-8 w-full max-w-3xl rounded-xl border border-[#d8b66b] bg-white p-5"><h3 className="display text-xl text-[#071b38]">Reward Records</h3><div className="mt-3 divide-y divide-[#eee6d7]">{fortuneRewards.map((reward) => <div key={reward.id} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="text-[#555]">{reward.description || 'Fortune Box reward'}<small className="mt-1 block text-xs text-[#888]">{new Date(reward.created_at).toLocaleString()}</small></span><strong className="text-[#94702e]">{Number(reward.amount).toFixed(2)} credits</strong></div>)}</div></section> : null}
              {!currentLevelUnlocked ? <p className="mt-6 border border-border p-5 text-sm text-ink-soft">This badge is locked. The administrator must unlock it before you can continue.</p> : (
                <>
                  {loadingProjects ? <p className="mt-8 text-sm text-ink-soft">Loading projects…</p> : (
                    <>
                    <div className="mx-auto mt-8 w-full max-w-2xl">
                      {currentProjectIndex >= 20 ? <div className="rounded-2xl border border-[#d8b66b] bg-white px-6 py-10 text-center shadow-lg"><h3 className="display text-2xl text-[#071b38]">20 properties ordered</h3><p className="mt-3 text-sm text-ink-soft">Please contact Customer Support to request the next level or badge unlock.</p></div> : null}
                      {currentProjectIndex < 20 ? projectCards.slice(0, 1).map((project, index) => {
                        const cardIndex = currentProjectIndex + index
                        const image = project.cover_image_url || SAMPLE_IMAGES[cardIndex % SAMPLE_IMAGES.length]
                        return <article key={project?.id || index} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[#d8b66b] bg-white shadow-lg shadow-[#071b38]/10">
                          <div className="relative overflow-hidden"><img src={image} alt={project.name} loading="lazy" className="aspect-[16/7] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" /><span className="eyebrow absolute left-3 top-3 rounded-md border border-[#f1d28d] bg-[#071b38]/90 px-3 py-1.5 text-[0.48rem] text-[#f1d28d]">NO OF PROMOTION {cardIndex + 1}/20</span></div>
                          <div className="flex flex-1 flex-col p-4 sm:p-5"><div className="mb-3"><div className="mb-2 flex items-center justify-between text-[0.65rem]"><span className="font-semibold uppercase tracking-wider text-ink-soft">{selectedLevel === 'Junior Trial' ? 'Trial progress' : 'Badge progress'}</span><strong className="text-[#9a793b]">{currentProgressPercent}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#e9e3d6]"><div className="h-full rounded-full bg-[#b18b43] transition-all" style={{ width: `${currentProgressPercent}%` }} /></div><p className="mt-1 text-[0.6rem] text-ink-soft">{fundedPropertyIds.size} of 20 properties funded</p></div><h3 className="display text-xl text-[#071b38]">{project.name}</h3><p className="mt-2 text-xs text-ink-soft">{project.location || 'Muscat, Oman'}</p>{!project.price_amount ? <p className="mt-3 text-sm text-ink-soft">{project.price_label || 'Price to be set by admin'}</p> : null}{project?.price_amount ? <p className="mt-1 text-sm font-medium">Base price: {displayMoney(Number(project.price_amount))}</p> : null}<p className="mt-2 line-clamp-2 text-xs text-ink-soft">{project.description || ''}</p>{project.price_amount && project.price_amount > 0 ? <div className="mt-3 grid gap-2 border-t border-border pt-3"><div className="flex items-center justify-between"><span className="eyebrow text-[0.5rem] text-ink-soft">Commission rate</span><strong className="text-sm">{project.order_percentages?.[0] ?? 0}%</strong></div><div className="flex items-center justify-between text-xs text-ink-soft"><span>Order amount</span><strong className="text-foreground">{displayMoney(Number(project.price_amount))}</strong></div><div className="flex items-center justify-between text-xs text-ink-soft"><span>Commission</span><strong className="text-foreground">{displayMoney(Number(project.price_amount) * Number(project.order_percentages?.[0] ?? 0) / 100)}</strong></div><div className="flex items-center justify-between border-t border-border pt-2 text-xs text-ink-soft"><span>{selectedLevel === 'Junior Trial' ? 'Trial Bonus balance' : 'Wallet balance'}</span><strong className="text-foreground">{displayMoney(selectedLevel === 'Junior Trial' ? trialBonusBalanceOmr : walletBalanceOmr)}</strong></div><button type="button" disabled={busyProject === project.id || !project.order_percentages?.length || requests.some((request) => request.user_id === currentUserId && request.property_id === project.id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase()))} onClick={() => void requestProject(project)} className="eyebrow w-full rounded-lg border border-[#d8b66b] bg-[#071b38] px-3 py-2.5 text-[0.58rem] font-semibold tracking-widest text-[#f1d28d] transition hover:bg-[#10294b] disabled:cursor-not-allowed disabled:opacity-40">{busyProject === project.id ? 'Sending…' : requests.some((request) => request.user_id === currentUserId && request.property_id === project.id && !['rejected', 'cancelled'].includes(String(request.status).toLowerCase())) ? 'Already ordered' : 'Order project'}</button></div> : <p className="mt-5 border border-dashed border-border p-3 text-xs text-ink-soft">Awaiting admin price and order settings</p>}</div>
                        </article>
                      }) : null}
                      {projectCards.length === 0 && currentProjectIndex < 20 ? <p className="border border-border bg-card p-6 text-sm text-ink-soft">No un-ordered properties are available in this progression. Contact the administrator.</p> : null}
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
