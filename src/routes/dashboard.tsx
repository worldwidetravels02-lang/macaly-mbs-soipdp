import { useAuthActions } from '@convex-dev/auth/react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '@/convex/_generated/api'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { formatAed, formatDate } from '../lib/format'
import { errorMessage } from '../lib/errors'
import { canonicalUrl } from '../lib/canonical-url'
import { TIERS } from '@/convex/tiers'
import { MEMBER_PROJECTS } from '../data/projects'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/dashboard']

const SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'orders', label: 'Orders' },
  { id: 'account', label: 'Account' },
  { id: 'support', label: 'Customer support' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

type OrderKind = 'all' | 'deposits' | 'withdrawals'
type OrderStatus = 'all' | 'completed' | 'pending' | 'rejected'

/** Wallet entry types that put money into the account. */
const DEPOSIT_TYPES = new Set(['topup', 'deposit', 'bonus', 'profit', 'commission'])

export const Route = createFileRoute('/dashboard')({
  head: () => {
    const canonical = canonicalUrl('/dashboard')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'robots', content: 'noindex' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: DashboardPage,
})

function DashboardPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <AuthLoading>
            <div
              data-testid="dashboard-loading"
              className="border border-border bg-card p-10 text-center text-sm text-ink-soft"
            >
              Opening your dashboard…
            </div>
          </AuthLoading>
          <Unauthenticated>
            <div data-testid="dashboard-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Member area</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Sign in to open your dashboard.</h1>
              <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
                Your dashboard holds your projects, orders, account details and a direct line to the
                customer support team.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/login"
                  className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Login
                  <ArrowRight />
                </Link>
                <Link
                  to="/register"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
                >
                  Create an account
                  <ArrowRight />
                </Link>
              </div>
            </div>
          </Unauthenticated>
          <Authenticated>
            <MemberDashboard />
          </Authenticated>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function MemberDashboard() {
  const me = useQuery(api.members.me)
  const wallet = useQuery(api.wallet.myWallet)
  const investments = useQuery(api.investments.myInvestments)
  const standing = useQuery(api.accountState.myState)
  const thread = useQuery(api.support.myThread)
  const sendMessage = useMutation(api.support.sendMessage)
  const saveProfile = useMutation(api.members.saveProfile)
  const ranks = useQuery(api.investments.ranks)
  const placeOrder = useMutation(api.investments.request)
  const myTasks = useQuery(api.tasks.myTasks)
  const submitTask = useMutation(api.tasks.submit)
  const [section, setSection] = useState<SectionId>('dashboard')
  const [orderKind, setOrderKind] = useState<OrderKind>('all')
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('all')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editMobile, setEditMobile] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const [orderingId, setOrderingId] = useState<string | null>(null)
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null)
  const [catalogueOpen, setCatalogueOpen] = useState(false)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const name = me?.profile?.fullName ?? me?.name ?? 'Member'
  const firstName = name.split(' ')[0]
  const projects = investments ?? []
  const allowance = TIERS.find((tier) => tier.level === (wallet?.tier.level ?? 1))?.propertyAllowance ?? 20
  const unlocked = projects.filter((row) => row.status === 'approved' || row.status === 'funded').length
  const pendingProjects = projects.filter((row) => row.status === 'pending').length
  const orders = wallet?.transactions ?? []
  const visibleOrders = orders.filter((row) => {
    const kindMatches =
      orderKind === 'all' ||
      (orderKind === 'deposits' ? DEPOSIT_TYPES.has(row.type) : row.type === 'withdrawal')
    const statusMatches = orderStatus === 'all' || row.status === orderStatus
    return kindMatches && statusMatches
  })
  useEffect(() => {
    if (profileReady || !me) return
    setEditName(me.profile?.fullName ?? me.name ?? '')
    setEditMobile(me.profile?.mobile ?? '')
    setEditAddress(me.profile?.address ?? '')
    setProfileReady(true)
  }, [me, profileReady])

  const submitProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setNotice(null)
    setError(null)
    if (editName.trim().length < 2) return setError('Please enter your full name.')
    if (editMobile.replace(/\D/g, '').length < 7) return setError('Please enter a valid phone number.')
    setSavingProfile(true)
    try {
      await saveProfile({
        fullName: editName.trim(),
        mobile: editMobile.trim(),
        address: editAddress.trim(),
      })
      setNotice('Your details were saved.')
    } catch (err) {
      setError(errorMessage(err, 'Could not save your details'))
    } finally {
      setSavingProfile(false)
    }
  }

  const level = wallet?.tier.level ?? 1
  const levelName = wallet?.tier.name ?? 'Level 1'

  const markTaskDone = async (id: string, title: string) => {
    setNotice(null)
    setError(null)
    setSubmittingTaskId(id)
    try {
      await submitTask({ id: id as never })
      setNotice(`“${title}” sent to administration for approval.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not send that task'))
    } finally {
      setSubmittingTaskId(null)
    }
  }

  const submitOrder = async (projectId: string, quantity = 1) => {
    setNotice(null)
    setError(null)
    const project = MEMBER_PROJECTS.find((row) => row.id === projectId)
    const rank = ranks?.find((row) => row.level === level) ?? ranks?.[0]
    if (!project || !rank) return setError('Could not place that order. Please try again.')
    const units = Math.max(1, Math.min(20, Math.round(quantity)))
    setOrderingId(projectId)
    try {
      await placeOrder({
        residence: project.name,
        rankCode: rank.code,
        amountAed: rank.minAed * units,
        note: `${units} ${units === 1 ? 'unit' : 'units'}`,
      })
      // The card switches to "Order placed", so no extra confirmation is shown.
    } catch (err) {
      setError(errorMessage(err, 'Could not place that order'))
    } finally {
      setOrderingId(null)
    }
  }

  const submitSupport = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (message.trim() === '') {
      setError('Write a message first')
      return
    }
    setSending(true)
    try {
      await sendMessage({ body: message.trim() })
      setMessage('')
      setNotice('Message sent to the support team.')
    } catch (err) {
      setError(errorMessage(err, 'Could not send that message'))
    } finally {
      setSending(false)
    }
  }

  return (
    <div data-testid="dashboard" data-state="ready" className="grid gap-8 lg:grid-cols-[15rem_1fr] lg:items-start">
      <nav aria-label="Member dashboard" data-testid="dashboard-nav" className="border border-border bg-card p-4 lg:sticky lg:top-28 lg:border-0 lg:bg-transparent lg:p-0">
        <p className="eyebrow text-[0.5rem] text-ink-soft">My area</p>
        <ul className="mt-3 grid gap-1">
          {SECTIONS.map((item) => {
            const active = section === item.id
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSection(item.id)}
                  aria-current={active ? 'page' : undefined}
                  data-testid={`dashboard-nav-${item.id}`}
                  className={`w-full whitespace-nowrap border px-4 py-2.5 text-left text-[0.8rem] transition-colors lg:text-[0.85rem] ${
                    active
                      ? 'border-brass bg-brass/10 text-ink'
                      : 'border-border text-ink-soft hover:border-brass/60 hover:text-ink'
                  }`}
                >
                  {item.label}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="mt-4 border border-border bg-background p-4 lg:mt-5 lg:bg-card">
          <p className="eyebrow text-[0.45rem] text-ink-soft">Membership</p>
          <p className="display mt-2 text-lg">Level {level}</p>
          <p className="mt-1 text-xs text-ink-soft">{levelName}</p>
          <Link to="/membership" className="mt-3 inline-flex items-center gap-2 text-xs text-brass">
            View levels
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </nav>

      <div className="grid gap-6">
        {notice ? (
          <p data-testid="dashboard-notice" className="border border-brass/40 bg-brass/10 px-4 py-3 text-sm">
            {notice}
          </p>
        ) : null}
        {error ? (
          <p role="alert" data-testid="dashboard-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {section === 'dashboard' ? (
          <section data-testid="dashboard-section-dashboard" className="grid gap-5">
            <div className="border border-border bg-card p-6">
              <p className="eyebrow text-brass">Welcome back</p>
              <h1 className="display mt-3 text-[clamp(1.7rem,3vw,2.4rem)]">{firstName}</h1>
              <p className="mt-2 text-sm text-ink-soft">
                {standing?.status === 'active'
                  ? 'Your account is active and in good standing.'
                  : `Your account standing is ${standing?.status ?? 'active'}.`}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <SummaryCard label="Membership level" value={`Level ${level}`} hint={levelName} />
              <SummaryCard label="Projects" value={String(projects.length)} hint="Funded and pending" />
              <SummaryCard label="Orders" value={String(orders.length)} hint="Wallet activity" />
            </div>
            <div className="border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <h2 className="display text-lg">Recent orders</h2>
                <button
                  type="button"
                  onClick={() => setSection('orders')}
                  className="eyebrow text-[0.5rem] text-brass"
                  data-testid="dashboard-view-orders"
                >
                  View all
                </button>
              </div>
              {orders.length === 0 ? (
                <p className="px-6 py-6 text-sm text-ink-soft">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orders.slice(0, 4).map((row) => (
                    <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                      <div>
                        <p>{row.note ?? row.type}</p>
                        <p className="mt-1 text-xs text-ink-soft">{formatDate(row.createdAt)}</p>
                      </div>
                      <span className="text-right">{formatAed(row.amountAed)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ) : null}

        {section === 'tasks' ? (
          <section data-testid="dashboard-section-tasks" className="border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h1 className="display text-xl">Tasks</h1>
              <p className="mt-1 text-xs text-ink-soft">
                Complete a task and administration unlocks the level it belongs to.
              </p>
            </div>
            {(myTasks ?? []).length === 0 ? (
              <p data-testid="dashboard-tasks-empty" className="px-6 py-8 text-sm text-ink-soft">
                No tasks yet. Administration assigns a task before each level unlock.
              </p>
            ) : (
              <ul data-testid="dashboard-tasks" data-state={myTasks ? 'ready' : 'loading'} className="divide-y divide-border">
                {(myTasks ?? []).map((task) => {
                  const busy = submittingTaskId === task.id
                  return (
                    <li key={task.id} data-testid={`dashboard-task-${task.id}`} className="px-6 py-5">
                      <div className="flex flex-wrap items-baseline justify-between gap-3">
                        <p className="display text-lg">{task.title}</p>
                        <span data-testid={`dashboard-task-status-${task.id}`} className="eyebrow text-[0.45rem] text-brass">
                          {task.status === 'pending'
                            ? 'To do'
                            : task.status === 'submitted'
                              ? 'Waiting for approval'
                              : task.status === 'approved'
                                ? 'Approved'
                                : 'Needs another try'}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-ink-soft">
                        Unlocks {task.targetLevelName} · assigned {formatDate(task.createdAt)}
                      </p>
                      {task.detail ? <p className="mt-3 text-sm text-ink-soft">{task.detail}</p> : null}
                      {task.status === 'rejected' && task.reviewNote ? (
                        <p data-testid={`dashboard-task-reason-${task.id}`} className="mt-3 border-l-2 border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-ink">
                          Why it needs another try: {task.reviewNote}
                        </p>
                      ) : null}
                      {task.status === 'pending' || task.status === 'rejected' ? (
                        <button
                          type="button"
                          onClick={() => markTaskDone(task.id, task.title)}
                          disabled={busy}
                          data-testid={`dashboard-task-submit-${task.id}`}
                          className="eyebrow mt-4 border border-brass px-5 py-2.5 text-[0.5rem] transition-colors hover:bg-brass/10 disabled:opacity-60"
                        >
                          {busy ? 'Sending…' : 'Mark as done'}
                        </button>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        ) : null}

        {section === 'projects' ? (
          <section data-testid="dashboard-section-projects" className="border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h1 className="display text-xl">Projects</h1>
              <p className="mt-1 text-xs text-ink-soft">Every residence project you have ordered, with administration unlocking each one.</p>
              <p data-testid="dashboard-project-allowance" className="mt-3 text-sm">
                Level {level} unlocks <strong>{allowance} projects</strong> · {unlocked} unlocked ·{' '}
                {pendingProjects} awaiting approval
              </p>
              <button
                type="button"
                onClick={() => setCatalogueOpen((open) => !open)}
                aria-expanded={catalogueOpen}
                data-testid="dashboard-projects-open"
                className="eyebrow mt-4 inline-flex items-center gap-3 border border-brass px-5 py-3 text-[0.5rem] transition-colors hover:bg-brass/10"
              >
                {catalogueOpen ? 'Hide projects' : `View Level ${level} projects (${allowance})`}
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
            <div
              data-testid="dashboard-project-catalogue"
              data-state={ranks ? 'ready' : 'loading'}
              hidden={!catalogueOpen}
              className="grid gap-5 px-6 py-6 sm:grid-cols-2 xl:grid-cols-3"
            >
              {MEMBER_PROJECTS.slice(0, allowance).map((project) => {
                const ordered = projects.some((row) => row.residence === project.name)
                const busy = orderingId === project.id
                const quantity = quantities[project.id] ?? 1
                return (
                  <article
                    key={project.id}
                    data-testid={`dashboard-project-card-${project.id}`}
                    className="flex h-full flex-col border border-border bg-background"
                  >
                    <img
                      src={project.image}
                      alt={project.alt}
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                    <div className="flex flex-1 flex-col p-4">
                      <p className="eyebrow text-[0.45rem] text-brass">{project.area}</p>
                      <h2 className="display mt-2 text-base">{project.name}</h2>
                      <p className="mt-1 text-xs text-ink-soft">{project.price}</p>
                      <div className="mt-4 flex items-center justify-between gap-2 border border-border">
                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((current) => ({
                              ...current,
                              [project.id]: Math.max(1, quantity - 1),
                            }))
                          }
                          disabled={ordered || busy || quantity <= 1}
                          aria-label={`Decrease quantity for ${project.name}`}
                          data-testid={`dashboard-project-qty-down-${project.id}`}
                          className="px-3 py-2 text-base leading-none transition-colors hover:bg-brass/10 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span
                          data-testid={`dashboard-project-qty-${project.id}`}
                          className="text-sm tabular-nums"
                        >
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            setQuantities((current) => ({
                              ...current,
                              [project.id]: Math.min(20, quantity + 1),
                            }))
                          }
                          disabled={ordered || busy || quantity >= 20}
                          aria-label={`Increase quantity for ${project.name}`}
                          data-testid={`dashboard-project-qty-up-${project.id}`}
                          className="px-3 py-2 text-base leading-none transition-colors hover:bg-brass/10 disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => submitOrder(project.id, quantity)}
                        disabled={ordered || busy}
                        data-testid={`dashboard-project-order-${project.id}`}
                        className="eyebrow mt-3 w-full border border-brass px-4 py-2.5 text-[0.5rem] transition-colors hover:bg-brass/10 disabled:cursor-not-allowed disabled:border-border disabled:text-ink-soft"
                      >
                        {ordered
                          ? 'Order placed'
                          : busy
                            ? 'Placing order…'
                            : `Order ${quantity} ${quantity === 1 ? 'unit' : 'units'}`}
                      </button>
                    </div>
                  </article>
                )
              })}
            </div>

            {projects.length === 0 ? (
              <div className="px-6 py-8">
                <p className="text-sm text-ink-soft">You have no projects yet.</p>
                <Link
                  to="/residences"
                  className="eyebrow mt-4 inline-flex items-center gap-3 border border-border px-5 py-3 text-[0.55rem] transition-colors hover:border-brass"
                >
                  Browse residences
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {projects.map((row) => (
                  <li key={row.id} data-testid={`dashboard-project-${row.id}`} className="px-6 py-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <p className="display text-lg">{row.residence}</p>
                      <span className="eyebrow text-[0.45rem] text-brass">{row.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-ink-soft">
                      {row.rankName} · {formatDate(row.fundedAt ?? row.createdAt)}
                    </p>
                    <p className="mt-2 text-sm">{formatAed(row.amountAed)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {section === 'orders' ? (
          <section data-testid="dashboard-section-orders" className="border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h1 className="display text-xl">Orders</h1>
              <p className="mt-1 text-xs text-ink-soft">Deposits, withdrawals and every wallet entry on your account.</p>
            </div>
            <div className="grid gap-3 border-b border-border px-6 py-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="eyebrow text-[0.45rem] text-ink-soft">Show</span>
                <select
                  value={orderKind}
                  onChange={(event) => setOrderKind(event.target.value as OrderKind)}
                  data-testid="dashboard-orders-kind"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-brass"
                >
                  <option value="all">All orders</option>
                  <option value="deposits">Deposits only</option>
                  <option value="withdrawals">Withdrawals only</option>
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow text-[0.45rem] text-ink-soft">Status</span>
                <select
                  value={orderStatus}
                  onChange={(event) => setOrderStatus(event.target.value as OrderStatus)}
                  data-testid="dashboard-orders-status"
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-brass"
                >
                  <option value="all">Any status</option>
                  <option value="completed">Completed</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <p data-testid="dashboard-orders-count" className="border-b border-border px-6 py-3 text-xs text-ink-soft">
              Showing {visibleOrders.length} of {orders.length} orders
            </p>
            {orders.length === 0 ? (
              <p className="px-6 py-8 text-sm text-ink-soft">No orders yet.</p>
            ) : visibleOrders.length === 0 ? (
              <p data-testid="dashboard-orders-empty" className="px-6 py-8 text-sm text-ink-soft">
                No orders match these filters.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {visibleOrders.map((row) => (
                  <li key={row.id} data-testid={`dashboard-order-${row.id}`} className="flex items-start justify-between gap-4 px-6 py-4">
                    <div>
                      <p className="text-sm">{row.note ?? row.type}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {row.type} · {row.status} · {formatDate(row.createdAt)}
                      </p>
                    </div>
                    <span className="text-sm">{formatAed(row.amountAed)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        {section === 'account' ? (
          <section data-testid="dashboard-section-account" className="border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h1 className="display text-xl">Account</h1>
              <p className="mt-1 text-xs text-ink-soft">Your details and membership standing.</p>
            </div>
            <form onSubmit={submitProfile} data-testid="dashboard-profile-form" data-state={profileReady ? 'ready' : 'loading'} className="grid gap-4 px-6 py-5">
              <label className="grid gap-1.5">
                <span className="eyebrow text-[0.45rem] text-ink-soft">Name</span>
                <input
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  data-testid="dashboard-profile-name"
                  autoComplete="name"
                  className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow text-[0.45rem] text-ink-soft">Phone number</span>
                <input
                  value={editMobile}
                  onChange={(event) => setEditMobile(event.target.value)}
                  data-testid="dashboard-profile-mobile"
                  autoComplete="tel"
                  inputMode="tel"
                  className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="eyebrow text-[0.45rem] text-ink-soft">Address</span>
                <textarea
                  value={editAddress}
                  onChange={(event) => setEditAddress(event.target.value)}
                  data-testid="dashboard-profile-address"
                  rows={3}
                  autoComplete="street-address"
                  placeholder="Building, street, city, country"
                  className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                />
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  disabled={savingProfile}
                  data-testid="dashboard-profile-save"
                  className="eyebrow bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
                >
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
                <span className="text-xs text-ink-soft">Email {me?.email ?? 'not set'} cannot be changed here.</span>
              </div>
            </form>
            <dl className="divide-y divide-border border-t border-border text-sm">
              <Row label="Membership level" value={`Level ${level} · ${levelName}`} />
              <Row label="Referral code" value={me?.profile?.referralCode ?? 'Not set'} />
              <Row label="Account standing" value={standing?.status ?? 'active'} />
            </dl>
            <div className="flex flex-wrap gap-3 px-6 py-5">
              <Link
                to="/account"
                className="eyebrow inline-flex items-center gap-3 bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85"
              >
                Open account page
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                to="/membership"
                className="eyebrow inline-flex items-center gap-3 border border-border px-5 py-3 text-[0.55rem] transition-colors hover:border-brass"
              >
                Membership levels
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </section>
        ) : null}

        {section === 'support' ? (
          <section data-testid="dashboard-section-support" className="border border-border bg-card">
            <div className="border-b border-border px-6 py-5">
              <h1 className="display text-xl">Customer support</h1>
              <p className="mt-1 text-xs text-ink-soft">Message the team directly. Replies appear here.</p>
            </div>
            {thread && thread.messages.length > 0 ? (
              <ul data-testid="dashboard-support-messages" className="max-h-80 divide-y divide-border overflow-y-auto">
                {thread.messages.map((row) => (
                  <li key={row.id} className="px-6 py-4 text-sm">
                    <p className="eyebrow text-[0.45rem] text-ink-soft">
                      {row.authorRole === 'admin' ? 'Support' : 'You'} · {formatDate(row.createdAt)}
                    </p>
                    <p className="mt-1.5 leading-relaxed">{row.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-6 py-6 text-sm text-ink-soft">No messages yet. Send the first one below.</p>
            )}
            <form onSubmit={submitSupport} className="grid gap-3 border-t border-border px-6 py-5">
              <label className="eyebrow text-[0.5rem] text-ink-soft" htmlFor="dashboard-support-input">
                Message
              </label>
              <textarea
                id="dashboard-support-input"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={3}
                data-testid="dashboard-support-input"
                className="w-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-brass"
              />
              <button
                type="submit"
                disabled={sending}
                data-testid="dashboard-support-send"
                className="eyebrow inline-flex w-fit items-center gap-3 bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
              >
                {sending ? 'Sending' : 'Send message'}
                <ArrowRight className="h-3 w-3" />
              </button>
            </form>
          </section>
        ) : null}
      </div>
    </div>
  )
}

function SummaryCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="eyebrow text-[0.45rem] text-ink-soft">{label}</p>
      <p className="display mt-2 text-2xl">{value}</p>
      <p className="mt-1 text-xs text-ink-soft">{hint}</p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 px-6 py-4">
      <dt className="eyebrow text-[0.45rem] text-ink-soft">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
