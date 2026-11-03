import { createFileRoute, Link } from '@tanstack/react-router'
import { useAuthActions } from '@convex-dev/auth/react'
import { useAction, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '@/convex/_generated/api'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { JournalEditor } from '../components/journal-editor'
import { DataBackup } from '../components/data-backup'
import { RESIDENCES } from '../data/site'
import { errorMessage } from '../lib/errors'
import { formatAed, formatDate } from '../lib/format'
import { formatMoney } from '../lib/currency'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const LEVEL_OPTIONS = [
  { level: 1, label: 'Level 1 · Resident (20 projects)' },
  { level: 2, label: 'Level 2 · Investor (40 projects)' },
  { level: 3, label: 'Level 3 · Portfolio (60 projects)' },
  { level: 4, label: 'Senior Projects (80 projects)' },
  { level: 5, label: 'Premium Projects (100 projects)' },
  { level: 6, label: 'Exclusive Projects (120 projects)' },
]

const ADMIN_GROUPS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'projects', label: 'Projects' },
  { id: 'users', label: 'Users' },
  { id: 'transactions', label: 'Transactions' },
  { id: 'journal', label: 'Journal' },
  { id: 'settings', label: 'Settings' },
]

/** Which of the five panel groups each section belongs to. */
const SECTION_GROUP: Record<string, string> = {
  overview: 'dashboard',
  investments: 'projects',
  profits: 'projects',
  plans: 'projects',
  levels: 'projects',
  'level-profit': 'projects',
  prices: 'projects',
  promotions: 'projects',
  registrations: 'users',
  tasks: 'users',
  investors: 'users',
  verifications: 'users',
  support: 'users',
  withdrawals: 'transactions',
  balances: 'transactions',
  deposits: 'transactions',
  crypto: 'transactions',
  'card-payments': 'transactions',
  topups: 'transactions',
  commissions: 'transactions',
  'record-payment': 'transactions',
  journal: 'journal',
  backup: 'settings',
  'payment-details': 'settings',
  administrators: 'settings',
  'add-admin': 'settings',
  'admin-login': 'settings',
  passcode: 'settings',
  alerts: 'settings',
}

const meta = siteMetadata['/admin']

export const Route = createFileRoute('/admin')({
  head: () => {
    const canonical = canonicalUrl('/admin')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
        { name: 'robots', content: 'noindex' },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const status = useQuery(api.admin.status)
  const ensureAdmin = useMutation(api.admin.ensureAdmin)

  useEffect(() => {
    if (!status?.signedIn || status.isAdmin) return
    ensureAdmin().catch((err) => console.error('Could not check owner access', err))
  }, [status?.signedIn, status?.isAdmin, ensureAdmin])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          {status === undefined ? (
            <div data-testid="admin-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
              Checking administration access…
            </div>
          ) : status.isAdmin ? (
            <AdminDashboard />
          ) : (
            <AccessGate signedIn={status.signedIn} adminExists={status.adminExists} />
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function AccessGate({ signedIn, adminExists }: { signedIn: boolean; adminExists: boolean }) {
  const claimAdmin = useMutation(api.admin.claimAdmin)
  const activateAdmin = useMutation(api.adminPasscode.activateAdmin)
  const createAdminAccount = useAction(api.adminPasscode.createAdminAccount)
  const [setup, setSetup] = useState({ email: '', password: '', passcode: '' })
  const [setupBusy, setSetupBusy] = useState(false)
  const { signIn } = useAuthActions()
  const [activationPasscode, setActivationPasscode] = useState('')
  const [activating, setActivating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  const [signingIn, setSigningIn] = useState(false)

  const submitAdminLogin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    if (credentials.email.trim() === '' || credentials.password === '') {
      setError('Enter the administrator email and password')
      return
    }
    setSigningIn(true)
    try {
      const formData = new FormData()
      formData.set('email', credentials.email.trim())
      formData.set('password', credentials.password)
      formData.set('flow', 'signIn')
      await signIn('password', formData)
      setCredentials({ email: '', password: '' })
    } catch (err) {
      setError(errorMessage(err, 'Email or password is incorrect'))
    } finally {
      setSigningIn(false)
    }
  }

  const activate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setActivating(true)
    try {
      await activateAdmin({ passcode: activationPasscode })
      setActivationPasscode('')
    } catch (err) {
      setError(errorMessage(err, 'Could not activate administration'))
    } finally {
      setActivating(false)
    }
  }

  const createAdministrator = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSetupBusy(true)
    try {
      await createAdminAccount({
        email: setup.email,
        password: setup.password,
        passcode: setup.passcode,
      })
      const formData = new FormData()
      formData.set('email', setup.email.trim().toLowerCase())
      formData.set('password', setup.password)
      formData.set('flow', 'signIn')
      await signIn('password', formData)
      setSetup({ email: '', password: '', passcode: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not create the administrator account'))
    } finally {
      setSetupBusy(false)
    }
  }

  const claim = async () => {
    setBusy(true)
    setError(null)
    try {
      await claimAdmin()
    } catch (err) {
      setError(errorMessage(err, 'Could not claim administration access'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div data-testid="admin-gate" className="border border-border bg-card p-8 sm:p-12">
      <p className="eyebrow text-brass">Administration</p>
      <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">
        {signedIn ? 'You do not have administration access.' : 'Sign in to open administration.'}
      </h1>
      <p className="mt-4 max-w-lg text-[0.98rem] leading-relaxed text-ink-soft">
        {adminExists
          ? 'Administration is limited to approved accounts. Ask an existing administrator to add your email address.'
          : 'No administrator exists yet. The first member to claim this area becomes the owner and can then add other administrators by email.'}
      </p>

      {error ? (
        <p role="alert" className="mt-6 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {!signedIn ? (
        <form
          onSubmit={submitAdminLogin}
          data-testid="admin-login-form"
          data-state={signingIn ? 'loading' : 'ready'}
          className="mt-8 grid max-w-md gap-4 border border-border bg-bone/40 p-5"
        >
          <p className="eyebrow text-[0.5rem] text-ink-soft">Administrator sign in</p>
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Email</span>
            <input
              type="email"
              autoComplete="email"
              required
              value={credentials.email}
              onChange={(event) =>
                setCredentials({ ...credentials, email: event.target.value })
              }
              data-testid="admin-login-email"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={credentials.password}
              onChange={(event) =>
                setCredentials({ ...credentials, password: event.target.value })
              }
              data-testid="admin-login-password"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          <button
            type="submit"
            disabled={signingIn}
            data-testid="admin-login-submit"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {signingIn ? 'Signing in' : 'Sign in and continue'}
            <ArrowRight />
          </button>
          <p className="text-xs leading-relaxed text-ink-soft">
            After signing in you will be asked for the admin passcode.
          </p>
        </form>
      ) : null}

      {!signedIn ? (
        <form
          onSubmit={createAdministrator}
          data-testid="admin-create-form"
          data-state={setupBusy ? 'loading' : 'ready'}
          className="mt-8 grid max-w-md gap-3 border border-border bg-bone/40 p-5"
        >
          <p className="eyebrow text-[0.5rem] text-ink-soft">Set up an administrator</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            Create an administrator account with the admin passcode. Use this on a new device or a
            fresh deployment.
          </p>
          <input
            type="email"
            required
            placeholder="Admin email"
            value={setup.email}
            onChange={(event) => setSetup({ ...setup, email: event.target.value })}
            data-testid="admin-create-email"
            className="w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
          />
          <input
            type="password"
            required
            placeholder="Password (at least 8 characters)"
            autoComplete="new-password"
            value={setup.password}
            onChange={(event) => setSetup({ ...setup, password: event.target.value })}
            data-testid="admin-create-password"
            className="w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
          />
          <input
            type="password"
            required
            placeholder="Admin passcode"
            value={setup.passcode}
            onChange={(event) => setSetup({ ...setup, passcode: event.target.value })}
            data-testid="admin-create-passcode"
            className="w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
          />
          <button
            type="submit"
            disabled={setupBusy}
            data-testid="admin-create-submit"
            className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass disabled:opacity-60"
          >
            {setupBusy ? 'Creating' : 'Create administrator'}
            <ArrowRight />
          </button>
        </form>
      ) : null}

      {signedIn && adminExists ? (
        <form
          onSubmit={activate}
          data-testid="admin-activate-form"
          data-state={activating ? 'loading' : 'ready'}
          className="mt-8 grid max-w-md gap-3 border border-border bg-bone/40 p-5"
        >
          <p className="eyebrow text-[0.5rem] text-ink-soft">Activate this account</p>
          <p className="text-xs leading-relaxed text-ink-soft">
            Enter the admin passcode to give this signed-in account administration access.
          </p>
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Admin passcode</span>
            <input
              type="password"
              autoComplete="current-password"
              value={activationPasscode}
              onChange={(event) => setActivationPasscode(event.target.value)}
              data-testid="admin-activate-passcode"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          <button
            type="submit"
            disabled={activating}
            data-testid="admin-activate-submit"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {activating ? 'Activating' : 'Activate administration'}
            <ArrowRight />
          </button>
        </form>
      ) : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">

        {!adminExists && signedIn ? (
          <button
            type="button"
            onClick={claim}
            disabled={busy}
            data-testid="claim-admin"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {busy ? 'Setting up…' : 'Claim administration access'}
            <ArrowRight />
          </button>
        ) : null}

        <Link
          to="/wallet"
          className="eyebrow inline-flex items-center justify-between gap-8 border border-border px-6 py-4 text-[0.6rem] transition-colors hover:border-brass"
        >
          My wallet
          <ArrowRight />
        </Link>
      </div>
    </div>
  )
}

function AdminDashboard() {
  const overview = useQuery(api.admin.overview)
  const unlockAdmin = useMutation(api.adminPasscode.unlock)
  const changePasscode = useMutation(api.adminPasscode.setPasscode)
  const passcodeStatus = useQuery(api.adminPasscode.status)
  const [passcodeDraft, setPasscodeDraft] = useState({ current: '', next: '', repeat: '' })
  const [passcodeState, setPasscodeState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [passcodeMessage, setPasscodeMessage] = useState('')
  const [unlocked, setUnlocked] = useState(false)
  const [activeGroup, setActiveGroup] = useState('dashboard')
  const sectionShown = (id: string) => SECTION_GROUP[id] === activeGroup
  const openSection = (id: string) => {
    setActiveGroup(SECTION_GROUP[id] ?? 'dashboard')
    try {
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 50)
    } catch {
      // Scrolling is optional.
    }
  }
  const [passcode, setPasscode] = useState('')
  const [gateBusy, setGateBusy] = useState(false)
  const [gateError, setGateError] = useState<string | null>(null)

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem('admin-passcode-ok') === '1') setUnlocked(true)
    } catch {
      // Storage can be blocked; the passcode is then asked again.
    }
  }, [])

  const submitPasscode = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setGateError(null)
    if (passcode.trim() === '') {
      setGateError('Enter the administration passcode')
      return
    }
    setGateBusy(true)
    try {
      const ok = await unlockAdmin({ passcode })
      if (!ok) {
        setGateError('That passcode is not correct')
        return
      }
      try {
        window.sessionStorage.setItem('admin-passcode-ok', '1')
      } catch {
        // Session storage is optional.
      }
      setPasscode('')
      setUnlocked(true)
    } catch (err) {
      setGateError(errorMessage(err, 'Could not check the passcode'))
    } finally {
      setGateBusy(false)
    }
  }
  const decideTopUp = useMutation(api.admin.decideTopUp)
  const decideWithdrawal = useMutation(api.admin.decideWithdrawal)
  const grantAdmin = useMutation(api.admin.grantAdmin)
  const revokeAdmin = useMutation(api.admin.revokeAdmin)
  const markNotificationsRead = useMutation(api.admin.markNotificationsRead)
  const adminThreads = useQuery(api.support.adminThreads)
  const creditMember = useMutation(api.admin.creditMember)
  const setPrice = useMutation(api.properties.setPrice)
  const rates = useQuery(api.currency.rates)
  const setRate = useMutation(api.currency.setRate)
  const cardPayments = useQuery(api.payments.adminPayments)
  const cardSummary = useQuery(api.payments.adminSummary)
  const investmentRequests = useQuery(api.investments.adminRequests)
  const decideInvestment = useMutation(api.investments.decide)
  const fundInvestment = useMutation(api.investments.fund)
  const adminPlans = useQuery(api.membership.adminPlans)
  const savePlan = useMutation(api.membership.savePlan)
  const setLevelProfit = useMutation(api.membership.setLevelProfit)
  const [profitDrafts, setProfitDrafts] = useState<Record<string, string>>({})
  const adjustBalance = useMutation(api.membership.adjustBalance)
  const setMemberLevel = useMutation(api.memberLevel.setLevel)
  const cryptoPayments = useQuery(api.cryptoPayments.adminList)
  const decideCrypto = useMutation(api.cryptoPayments.decide)
  const depositRecords = useQuery(api.admin.depositRecords)
  const [cryptoFilter, setCryptoFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const withdrawalRecords = useQuery(api.admin.withdrawalRecords)
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'pending' | 'completed' | 'rejected'>('pending')
  const [usersQuery, setUsersQuery] = useState('')
  const adminTasks = useQuery(api.tasks.adminTasks)
  const assignTask = useMutation(api.tasks.assign)
  const decideTask = useMutation(api.tasks.decide)
  const removeTask = useMutation(api.tasks.remove)
  const [taskUser, setTaskUser] = useState('')
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDetail, setTaskDetail] = useState('')
  const [taskLevel, setTaskLevel] = useState(2)
  const [taskBusy, setTaskBusy] = useState(false)
  const [taskReasons, setTaskReasons] = useState<Record<string, string>>({})
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'submitted' | 'approved' | 'rejected'>('all')
  const payouts = useQuery(api.profitPayouts.adminPayouts)
  const runPayouts = useMutation(api.profitPayouts.runMonthlyPayouts)
  const [payoutPeriod, setPayoutPeriod] = useState('')
  const [payoutState, setPayoutState] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [payoutMessage, setPayoutMessage] = useState('')
  const tasksWaiting = (adminTasks ?? []).filter((task) => task.status === 'submitted').length
  const filteredTasks = (adminTasks ?? []).filter(
    (task) => taskFilter === 'all' || task.status === taskFilter,
  )
  const usersTerm = usersQuery.trim().toLowerCase()
  const matchesUser = (name: string, email: string) =>
    usersTerm === '' ||
    name.toLowerCase().includes(usersTerm) ||
    email.toLowerCase().includes(usersTerm)
  const filteredRegistrations = (overview?.investors ?? []).filter((investor) =>
    matchesUser(investor.name, investor.email),
  )
  const filteredInvestors = (overview?.investors ?? []).filter((row) =>
    matchesUser(row.name, row.email),
  )
  const withdrawalRows = (withdrawalRecords ?? []).filter((row) => {
    if (withdrawalFilter === 'all') return true
    if (withdrawalFilter === 'completed') return row.status === 'approved'
    return row.status === withdrawalFilter
  })
  const savedDetails = useQuery(api.cryptoPayments.details)
  const savePaymentDetails = useMutation(api.cryptoPayments.saveDetails)
  const storedPrices = useQuery(api.properties.prices)
  const verifications = useQuery(api.verifications.adminVerifications)
  const decideVerification = useMutation(api.verifications.decideVerification)
  const accountStates = useQuery(api.accountState.adminStates)
  const promotions = useQuery(api.promotions.adminPromotions)
  const createPromotion = useMutation(api.promotions.createPromotion)
  const setPromotionActive = useMutation(api.promotions.setPromotionActive)
  const deletePromotion = useMutation(api.promotions.deletePromotion)
  const setAccountState = useMutation(api.accountState.setState)
  const adminReply = useMutation(api.support.adminReply)
  const adminDeleteMessage = useMutation(api.support.adminDeleteMessage)

  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const runInvestmentAction = async (action: () => Promise<unknown>, message: string) => {
    setError(null)
    setNotice(null)
    try {
      await action()
      setNotice(message)
    } catch (err) {
      setError(errorMessage(err, 'Could not update the investment'))
    }
  }
  const [confirmAction, setConfirmAction] = useState<{
    title: string
    detail: string
    confirmLabel: string
    run: () => Promise<void>
  } | null>(null)
  const [confirmBusy, setConfirmBusy] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const closeConfirm = () => {
    if (confirmBusy) return
    setConfirmAction(null)
    setConfirmError(null)
  }

  const acceptConfirm = async () => {
    if (!confirmAction) return
    setConfirmBusy(true)
    setConfirmError(null)
    try {
      await confirmAction.run()
      setConfirmAction(null)
    } catch (err) {
      setConfirmError(errorMessage(err, 'That action could not be completed'))
    } finally {
      setConfirmBusy(false)
    }
  }

  const [newAdmin, setNewAdmin] = useState('')
  const currentLogin = useQuery(api.adminCredentials.currentLogin)
  const updateLogin = useAction(api.adminCredentials.updateLogin)
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginConfirm, setLoginConfirm] = useState('')
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [payment, setPayment] = useState({ userId: '', amount: '', note: '', residence: RESIDENCES[0].name })
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({})
  const [planDrafts, setPlanDrafts] = useState<
    Record<string, { minAed: string; profit: string; commission: string; active: boolean }>
  >({})
  const [detailsDraft, setDetailsDraft] = useState<{
    bankName: string
    accountName: string
    accountNumber: string
    iban: string
    swift: string
    note: string
    crypto: { coin: string; network: string; address: string }[]
  } | null>(null)
  const [balanceDraft, setBalanceDraft] = useState({
    userId: '',
    direction: 'credit' as 'credit' | 'debit',
    amount: '',
    note: '',
  })
  const [verifyNotes, setVerifyNotes] = useState<Record<string, string>>({})
  const [stateReason, setStateReason] = useState('')
  const [offer, setOffer] = useState({ slug: RESIDENCES[0].slug as string, title: '', detail: '' })
  const threadMessages = useQuery(
    api.support.adminThreadMessages,
    activeThreadId ? { threadId: activeThreadId as never } : 'skip',
  )

  const reviewTopUp = async (requestId: string, approve: boolean) => {
    setError(null)
    try {
      await decideTopUp({ requestId: requestId as never, approve })
      setNotice(approve ? 'Top-up approved and credited to the wallet.' : 'Top-up request rejected.')
    } catch (err) {
      setError(errorMessage(err, 'Could not review that request'))
    }
  }

  const reviewWithdrawal = async (requestId: string, approve: boolean) => {
    setError(null)
    try {
      await decideWithdrawal({ requestId: requestId as never, approve })
      setNotice(approve ? 'Withdrawal approved and debited from the wallet.' : 'Withdrawal request rejected.')
    } catch (err) {
      setError(errorMessage(err, 'Could not review that request'))
    }
  }

  const addAdmin = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await grantAdmin({ email: newAdmin })
      setNotice(`${newAdmin} can now open the administration area.`)
      setNewAdmin('')
    } catch (err) {
      setError(errorMessage(err, 'Could not add that administrator'))
    }
  }

  const sendReply = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeThreadId) return
    setError(null)
    setNotice(null)
    try {
      await adminReply({ threadId: activeThreadId as never, body: reply })
      setReply('')
      setNotice('Reply sent to the member.')
    } catch (err) {
      setError(errorMessage(err, 'Could not send that reply'))
    }
  }

  const submitPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!payment.userId) return setError('Choose the member who made the payment')
    try {
      await creditMember({
        userId: payment.userId as never,
        amountAed: Number(payment.amount),
        note: payment.note || undefined,
        residence: payment.residence || undefined,
      })
      setNotice(`Payment of ${formatAed(Number(payment.amount))} added to the member wallet.`)
      setPayment({ userId: '', amount: '', note: '', residence: payment.residence })
    } catch (err) {
      setError(errorMessage(err, 'Could not record that payment'))
    }
  }

  const publishOffer = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setNotice(null)
    try {
      await createPromotion({
        slug: offer.slug,
        title: offer.title,
        detail: offer.detail || undefined,
      })
      setNotice('Offer published on the listing.')
      setOffer({ slug: offer.slug, title: '', detail: '' })
    } catch (err) {
      setError(errorMessage(err, 'Could not publish that offer'))
    }
  }

  const toggleOffer = async (promotionId: string, active: boolean) => {
    setError(null)
    setNotice(null)
    try {
      await setPromotionActive({ promotionId: promotionId as never, active })
      setNotice(active ? 'Offer is live.' : 'Offer paused.')
    } catch (err) {
      setError(errorMessage(err, 'Could not update that offer'))
    }
  }

  const removeOffer = async (promotionId: string) => {
    setError(null)
    setNotice(null)
    try {
      await deletePromotion({ promotionId: promotionId as never })
      setNotice('Offer deleted.')
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that offer'))
    }
  }

  const changeState = async (userId: string, status: 'active' | 'frozen' | 'blocked') => {
    setError(null)
    setNotice(null)
    try {
      await setAccountState({ userId: userId as never, status, reason: stateReason || undefined })
      setNotice(`Member standing set to ${status}.`)
      setStateReason('')
    } catch (err) {
      setError(errorMessage(err, 'Could not update that member'))
    }
  }

  const decideIdentity = async (
    verificationId: string,
    decision: 'approved' | 'rejected',
  ) => {
    setError(null)
    setNotice(null)
    try {
      await decideVerification({
        verificationId: verificationId as never,
        decision,
        reviewNote: verifyNotes[verificationId] || undefined,
      })
      setNotice(decision === 'approved' ? 'Identity approved.' : 'Identity rejected.')
    } catch (err) {
      setError(errorMessage(err, 'Could not record that decision'))
    }
  }

  const deleteMessage = async (messageId: string) => {
    setError(null)
    setNotice(null)
    try {
      await adminDeleteMessage({ messageId: messageId as never })
      setNotice('Message deleted.')
    } catch (err) {
      setError(errorMessage(err, 'Could not delete that message'))
    }
  }

  const savePrice = async (slug: string, fallback: string) => {
    setError(null)
    setNotice(null)
    try {
      await setPrice({ slug, priceLabel: priceDrafts[slug] ?? fallback })
      setNotice('Listing price updated for every page.')
    } catch (err) {
      setError(errorMessage(err, 'Could not update that price'))
    }
  }

  const clearAlerts = async () => {
    try {
      await markNotificationsRead()
    } catch (err) {
      setError(errorMessage(err, 'Could not clear alerts'))
    }
  }

  const removeAdmin = async (userId: string, email: string) => {
    setError(null)
    setNotice(null)
    try {
      await revokeAdmin({ userId: userId as never })
      setNotice(`${email} no longer has administration access.`)
    } catch (err) {
      setError(errorMessage(err, 'Could not remove that administrator'))
    }
  }

  if (overview === undefined) {
    return (
      <div data-testid="admin-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
        Loading administration…
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div data-testid="admin-lock" className="mx-auto max-w-md border border-border bg-card p-8">
        <p className="eyebrow text-brass">Administration</p>
        <h1 className="display mt-4 text-2xl">Enter the admin passcode.</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          The admin centre is locked with a passcode. It stays unlocked for this browser session.
        </p>
        <form onSubmit={submitPasscode} className="mt-6 grid gap-4">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Passcode</span>
            <input
              type="password"
              autoComplete="current-password"
              value={passcode}
              onChange={(event) => setPasscode(event.target.value)}
              data-testid="admin-passcode"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          {gateError ? (
            <p
              role="alert"
              data-testid="admin-passcode-error"
              className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            >
              {gateError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={gateBusy}
            data-testid="admin-passcode-submit"
            data-state={gateBusy ? 'loading' : 'ready'}
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {gateBusy ? 'Checking' : 'Unlock admin centre'}
            <ArrowRight />
          </button>
        </form>
      </div>
    )
  }

  return (
    <div data-testid="admin-dashboard" data-state="ready" className="grid gap-8">
      {confirmAction ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 px-4 py-6 sm:items-center"
          data-testid="admin-confirm-dialog"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-confirm-title"
            className="w-full max-w-lg border border-border bg-card p-6 shadow-xl"
          >
            <p className="eyebrow text-brass">Please confirm</p>
            <h2 id="admin-confirm-title" className="display mt-3 text-xl">
              {confirmAction.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">{confirmAction.detail}</p>
            {confirmError ? (
              <p
                role="alert"
                data-testid="admin-confirm-error"
                className="mt-4 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive"
              >
                {confirmError}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={acceptConfirm}
                disabled={confirmBusy}
                data-testid="admin-confirm-accept"
                data-state={confirmBusy ? 'loading' : 'ready'}
                className="eyebrow border border-brass bg-brass/10 px-5 py-3 text-[0.5rem] transition-colors hover:bg-brass/20 disabled:opacity-60"
              >
                {confirmBusy ? 'Working…' : confirmAction.confirmLabel}
              </button>
              <button
                type="button"
                onClick={closeConfirm}
                disabled={confirmBusy}
                data-testid="admin-confirm-cancel"
                className="eyebrow border border-border px-5 py-3 text-[0.5rem] text-ink-soft transition-colors hover:border-brass disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-brass">Administration</p>
          <h1 className="display mt-3 text-[clamp(1.9rem,3.4vw,2.8rem)]">Investor wallet overview</h1>
          <p className="mt-3 text-sm text-ink-soft">
            Top-up amounts, investor balances and money movement across every member.
          </p>
        </div>
        <Link
          to="/wallet"
          className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-5 py-3 text-[0.58rem] transition-colors hover:border-brass"
        >
          My wallet
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>

      {overview.unreadNotifications > 0 ? (
        <div
          role="status"
          data-testid="admin-alert-banner"
          className="flex flex-col gap-3 border border-brass/50 bg-brass/10 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p className="eyebrow text-[0.5rem] text-brass">New request</p>
            <p className="display mt-2 text-lg">
              {overview.unreadNotifications}{' '}
              {overview.unreadNotifications === 1 ? 'alert needs' : 'alerts need'} your attention
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {overview.notifications.filter((row) => !row.read).slice(0, 3).map((row) => row.title).join(' · ')}
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href="#alerts"
              className="eyebrow inline-flex items-center justify-between gap-6 bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Review alerts
              <ArrowRight className="h-3.5 w-3.5" />
            </a>
            <button
              type="button"
              onClick={clearAlerts}
              data-testid="admin-alert-banner-clear"
              className="eyebrow border border-border px-5 py-3 text-[0.55rem] transition-colors hover:border-brass"
            >
              Mark read
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" data-testid="admin-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p data-testid="admin-notice" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft">
          {notice}
        </p>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <nav
          aria-label="Admin centre"
          data-testid="admin-nav"
          className="border border-border bg-card lg:sticky lg:top-24"
        >
          <p className="eyebrow border-b border-border px-5 py-4 text-[0.45rem] text-ink-soft">
            Admin centre
          </p>
          <ul>
            {ADMIN_GROUPS.map((group) => (
              <li key={group.id}>
                <button
                  type="button"
                  onClick={() => setActiveGroup(group.id)}
                  data-testid={`admin-nav-${group.id}`}
                  data-active={activeGroup === group.id}
                  aria-current={activeGroup === group.id ? 'page' : undefined}
                  className={`flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left text-sm transition-colors ${
                    activeGroup === group.id
                      ? 'bg-brass/10 text-ink'
                      : 'text-ink-soft hover:bg-bone/60 hover:text-ink'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {group.label}
                    {group.id === 'users' && tasksWaiting > 0 ? (
                      <span
                        data-testid="admin-nav-tasks-badge"
                        className="min-w-5 bg-brass px-1.5 py-0.5 text-center text-[0.6rem] font-medium text-primary-foreground"
                      >
                        {tasksWaiting}
                      </span>
                    ) : null}
                  </span>
                  {activeGroup === group.id ? (
                    <span aria-hidden="true" className="h-1.5 w-1.5 bg-brass" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div data-testid="admin-section-panel" className="grid min-w-0 grid-cols-1 gap-6">

      <section
        id="overview"
        data-testid="admin-section-overview"
        style={{ display: sectionShown('overview') ? undefined : 'none' }}
        className="grid gap-6 scroll-mt-24"
      >
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Investors', value: String(overview.totals.investors), testId: 'admin-total-investors' },
          { label: 'Wallet balances', value: formatAed(overview.totals.walletBalanceAed), testId: 'admin-total-balance' },
          { label: 'Approved top-ups', value: formatAed(overview.totals.approvedTopUpAed), testId: 'admin-total-topups' },
          { label: 'Withdrawn', value: formatAed(overview.totals.withdrawnAed), testId: 'admin-total-withdrawn' },
        ].map((stat) => (
          <div key={stat.label} className="border border-border bg-card p-5">
            <dt className="eyebrow text-[0.5rem] text-ink-soft">{stat.label}</dt>
            <dd data-testid={stat.testId} className="display mt-3 text-xl">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: 'Investment approvals waiting', value: investmentRequests ? investmentRequests.filter((row) => row.status === 'pending').length : 0, section: 'investments' },
          { label: 'Withdrawals waiting', value: overview.pendingWithdrawals.length, section: 'withdrawals' },
          { label: 'Top-ups waiting', value: overview.pendingTopUps.length, section: 'topups' },
          { label: 'Unread alerts', value: overview.unreadNotifications, section: 'alerts' },
        ].map((card) => (
          <button
            key={card.label}
            type="button"
            onClick={() => openSection(card.section)}
            data-testid={`admin-overview-${card.section}`}
            className="flex items-center justify-between gap-4 border border-border bg-card px-5 py-4 text-left transition-colors hover:border-brass"
          >
            <span>
              <span className="eyebrow block text-[0.45rem] text-ink-soft">{card.label}</span>
              <span className="display mt-1.5 block text-xl">{card.value}</span>
            </span>
            <ArrowRight className="h-3.5 w-3.5 text-brass" />
          </button>
        ))}
      </div>
      </section>

      <section id="investments" style={{ display: sectionShown('investments') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="display text-xl">Investment approvals</h2>
            <p className="mt-1 text-xs text-ink-soft">
              A member requests an amount, administration approves it, then pays it into the wallet.
            </p>
          </div>
          <span className="eyebrow text-[0.5rem] text-ink-soft">
            {investmentRequests ? `${investmentRequests.filter((row) => row.status === 'pending').length} waiting` : 'Loading'}
          </span>
        </div>

        {investmentRequests === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading requests…</p>
        ) : investmentRequests.length === 0 ? (
          <p data-testid="admin-investments-empty" className="px-6 py-6 text-sm text-ink-soft">
            No investment requests yet.
          </p>
        ) : (
          <div data-testid="admin-investments" className="divide-y divide-border">
            {investmentRequests.map((row) => (
              <div
                key={row.id}
                data-testid={`admin-investment-${row.id}`}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm">
                    {row.name}
                    <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.rankName} · member level {row.memberLevel} ({row.memberRankName}) ·{' '}
                    {row.residence} · {formatAed(row.amountAed)} ·{' '}
                    {row.status === 'funded'
                      ? 'Paid to wallet'
                      : row.status === 'approved'
                        ? 'Approved, awaiting payment'
                        : row.status === 'pending'
                          ? 'Waiting for approval'
                          : 'Not approved'}
                  </p>
                  {row.note ? <p className="mt-1 text-xs text-ink-soft">{row.note}</p> : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {row.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => runInvestmentAction(() => decideInvestment({ id: row.id, decision: 'approve' }), 'Investment approved. Pay it into the wallet next.')}
                        data-testid={`admin-invest-approve-${row.id}`}
                        className="eyebrow border border-brass bg-brass/10 px-4 py-2.5 text-[0.5rem] transition-colors hover:bg-brass/20"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => runInvestmentAction(() => decideInvestment({ id: row.id, decision: 'reject' }), 'Investment rejected.')}
                        data-testid={`admin-invest-reject-${row.id}`}
                        className="eyebrow border border-destructive/40 px-4 py-2.5 text-[0.5rem] text-destructive transition-colors hover:bg-destructive/5"
                      >
                        Reject
                      </button>
                    </>
                  ) : null}

                  {row.status === 'approved' ? (
                    <button
                      type="button"
                      onClick={() => runInvestmentAction(() => fundInvestment({ id: row.id }), 'Funds added to the member wallet.')}
                      data-testid={`admin-invest-fund-${row.id}`}
                      className="eyebrow inline-flex items-center justify-between gap-4 bg-primary px-4 py-2.5 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
                    >
                      Pay to wallet
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="profits" style={{ display: sectionShown('profits') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Monthly profit payouts</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Profit is credited to member wallets automatically on the first of each month at their
            membership level percentage. You can also run a month by hand.
          </p>
        </div>

        <div data-testid="admin-profit-summary" className="grid gap-4 border-b border-border px-6 py-5 sm:grid-cols-3">
          <div>
            <p className="eyebrow text-[0.45rem] text-ink-soft">Profit paid</p>
            <p className="display mt-2 text-lg">
              {payouts ? formatAed(payouts.totals.paidAed) : 'Loading'}
            </p>
          </div>
          <div>
            <p className="eyebrow text-[0.45rem] text-ink-soft">Payouts</p>
            <p className="display mt-2 text-lg">
              {payouts ? payouts.totals.payouts : 'Loading'}
            </p>
          </div>
          <div>
            <p className="eyebrow text-[0.45rem] text-ink-soft">Last month paid</p>
            <p className="display mt-2 text-lg">
              {payouts ? payouts.totals.lastPeriodKey ?? 'None yet' : 'Loading'}
            </p>
          </div>
        </div>

        <form
          data-testid="admin-profit-run"
          className="flex flex-wrap items-end gap-3 border-b border-border px-6 py-5"
          onSubmit={(event) => {
            event.preventDefault()
            setPayoutMessage('')
            const requested = payoutPeriod.trim()
            if (requested !== '' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
              setPayoutState('error')
              setPayoutMessage('Use a month in the format YYYY-MM')
              return
            }
            const targetMonth = requested !== '' ? requested : payouts?.nextPeriodKey ?? ''
            const previewRows = payouts?.preview ?? []
            const willPay =
              targetMonth === payouts?.nextPeriodKey
                ? previewRows.filter((row) => !row.alreadyPaid)
                : previewRows
            const expectedTotal = willPay.reduce((sum, row) => sum + row.amountAed, 0)
            setConfirmError(null)
            setConfirmAction({
              title: `Run monthly payouts for ${targetMonth}?`,
              detail: `${willPay.length} ${willPay.length === 1 ? 'member' : 'members'} will be paid ${formatAed(expectedTotal)} in total, based on current balances and membership levels. Members already paid for ${targetMonth} are skipped, and this cannot be undone.`,
              confirmLabel: `Run ${targetMonth} payouts`,
              run: async () => {
                setPayoutState('running')
                try {
                  const result = await runPayouts({
                    periodKey: requested === '' ? undefined : requested,
                  })
                  setPayoutState('done')
                  setPayoutMessage(
                    `${result.periodKey}: ${result.credited} members credited, ${formatAed(result.totalAed)} paid.`,
                  )
                } catch (error) {
                  setPayoutState('error')
                  setPayoutMessage(errorMessage(error, 'Could not run the payout'))
                  throw error
                }
              },
            })
          }}
        >
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Month</span>
            <input
              type="text"
              value={payoutPeriod}
              onChange={(event) => setPayoutPeriod(event.target.value)}
              placeholder={payouts?.nextPeriodKey ?? 'YYYY-MM'}
              data-testid="admin-profit-period"
              className="mt-2 w-40 border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          <button
            type="submit"
            data-testid="admin-profit-submit"
            data-state={payoutState}
            disabled={payoutState === 'running'}
            className="eyebrow border border-brass bg-brass/10 px-4 py-3 text-[0.5rem] text-ink transition-colors hover:bg-brass/20 disabled:opacity-60"
          >
            {payoutState === 'running' ? 'Running' : 'Run monthly payouts'}
          </button>
          {payoutMessage ? (
            <p
              data-testid="admin-profit-message"
              className={`text-xs ${payoutState === 'error' ? 'text-destructive' : 'text-ink-soft'}`}
            >
              {payoutMessage}
            </p>
          ) : null}
        </form>

        <div className="border-b border-border px-6 py-5">
          <h3 className="eyebrow text-[0.5rem] text-ink-soft">Next run · expected amounts</h3>
          <div data-testid="admin-profit-preview" className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[40rem] text-left text-sm">
              <thead>
                <tr className="eyebrow text-[0.45rem] text-ink-soft">
                  <th scope="col" className="py-2 pr-4 font-normal">Member</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Level</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Percent</th>
                  <th scope="col" className="py-2 pr-4 font-normal">Base</th>
                  <th scope="col" className="py-2 font-normal">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(payouts?.preview ?? []).map((row) => (
                  <tr key={row.userId}>
                    <td className="py-2 pr-4">
                      {row.name}
                      <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                    </td>
                    <td className="py-2 pr-4">{row.planName}</td>
                    <td className="py-2 pr-4 text-ink-soft">{row.percent}%</td>
                    <td className="py-2 pr-4 text-ink-soft">{formatAed(row.basisAed)}</td>
                    <td className="py-2">
                      {formatAed(row.amountAed)}
                      {row.alreadyPaid ? (
                        <span className="ml-2 text-xs text-ink-soft">paid</span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {payouts === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading payouts…</p>
        ) : payouts.rows.length === 0 ? (
          <p data-testid="admin-profit-empty" className="px-6 py-6 text-sm text-ink-soft">
            No monthly profit has been paid yet.
          </p>
        ) : (
          <div data-testid="admin-profit-rows" className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="eyebrow text-[0.45rem] text-ink-soft">
                  <th scope="col" className="px-6 py-3 font-normal">Paid at</th>
                  <th scope="col" className="px-6 py-3 font-normal">Month</th>
                  <th scope="col" className="px-6 py-3 font-normal">Member</th>
                  <th scope="col" className="px-6 py-3 font-normal">Level</th>
                  <th scope="col" className="px-6 py-3 font-normal">Percent</th>
                  <th scope="col" className="px-6 py-3 font-normal">Base</th>
                  <th scope="col" className="px-6 py-3 font-normal">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payouts.rows.map((row) => (
                  <tr key={row.id} data-testid={`admin-profit-row-${row.id}`}>
                    <td className="px-6 py-3 text-ink-soft">{formatDate(row.createdAt)}</td>
                    <td className="px-6 py-3">{row.periodKey}</td>
                    <td className="px-6 py-3">
                      {row.name}
                      <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                    </td>
                    <td className="px-6 py-3">{row.planName}</td>
                    <td className="px-6 py-3 text-ink-soft">{row.percent}%</td>
                    <td className="px-6 py-3 text-ink-soft">{formatAed(row.basisAed)}</td>
                    <td className="px-6 py-3">{formatAed(row.amountAed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {activeGroup === 'users' ? (
        <div data-testid="admin-users-search-panel" className="border border-border bg-card p-5">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Find a customer</span>
            <input
              type="search"
              value={usersQuery}
              onChange={(event) => setUsersQuery(event.target.value)}
              placeholder="Search by name or email"
              data-testid="admin-users-search"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>
          <p data-testid="admin-users-search-count" className="mt-2 text-xs text-ink-soft">
            {filteredInvestors.length} of {overview.investors.length} customers
            {usersTerm ? ` match “${usersQuery.trim()}”` : ''}
          </p>
        </div>
      ) : null}

      <section id="registrations" style={{ display: sectionShown('registrations') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Customer registrations</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Every registered customer with contact details, a level selector and registration time. Change a level and it saves immediately.
          </p>
        </div>
        <div data-testid="admin-registrations" className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="eyebrow text-[0.45rem] text-ink-soft">
                <th scope="col" className="px-6 py-3 font-normal">Name</th>
                <th scope="col" className="px-6 py-3 font-normal">Email</th>
                <th scope="col" className="px-6 py-3 font-normal">Mobile</th>
                <th scope="col" className="px-6 py-3 font-normal">Level</th>
                <th scope="col" className="px-6 py-3 font-normal">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRegistrations.map((investor) => (
                <tr key={investor.userId} data-testid={`admin-registration-${investor.userId}`}>
                  <td className="px-6 py-3">{investor.name}</td>
                  <td className="px-6 py-3 text-ink-soft">{investor.email}</td>
                  <td className="px-6 py-3 text-ink-soft">{investor.mobile || 'Not provided'}</td>
                  <td className="px-6 py-3">
                    <select
                      value={investor.level}
                      onChange={(event) => {
                        const level = Number(event.target.value)
                        setMemberLevel({ userId: investor.userId as never, level })
                          .then(() => setNotice(`${investor.name} is now Level ${level}.`))
                          .catch((err) => setError(errorMessage(err, 'Could not change the level')))
                      }}
                      data-testid={`admin-registration-level-${investor.userId}`}
                      aria-label={`Membership level for ${investor.name}`}
                      className="w-full min-w-[11rem] border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-brass"
                    >
                      {LEVEL_OPTIONS.map((option) => (
                        <option key={option.level} value={option.level}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p data-testid={`admin-registration-level-name-${investor.userId}`} className="mt-1 text-xs text-ink-soft">
                      {investor.tierName}
                    </p>
                  </td>
                  <td className="px-6 py-3 text-ink-soft">{formatDate(investor.joinedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 ? (
            <p data-testid="admin-registrations-empty" className="px-6 py-6 text-sm text-ink-soft">
              No customers match “{usersQuery}”.
            </p>
          ) : null}
        </div>
      </section>

      <section id="tasks" style={{ display: sectionShown('tasks') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display flex items-center gap-2 text-xl">
            Level unlock tasks
            {tasksWaiting > 0 ? (
              <span
                data-testid="admin-tasks-waiting-badge"
                className="bg-brass px-2 py-0.5 text-[0.65rem] font-medium text-primary-foreground"
              >
                {tasksWaiting} waiting
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-xs text-ink-soft">
            Assign a task with the level it unlocks. When the member marks it done and you approve, the level is applied.
          </p>
        </div>
        <form
          data-testid="admin-task-form"
          onSubmit={async (event) => {
            event.preventDefault()
            setNotice(null)
            setError(null)
            if (!taskUser) return setError('Choose the member for this task.')
            if (taskTitle.trim().length < 3) return setError('Give the task a short title.')
            setTaskBusy(true)
            try {
              await assignTask({
                userId: taskUser as never,
                title: taskTitle.trim(),
                detail: taskDetail.trim() || undefined,
                targetLevel: taskLevel,
              })
              setNotice(`Task assigned. It unlocks Level ${taskLevel}.`)
              setTaskTitle('')
              setTaskDetail('')
            } catch (err) {
              setError(errorMessage(err, 'Could not assign that task'))
            } finally {
              setTaskBusy(false)
            }
          }}
          className="grid gap-4 border-b border-border px-6 py-5 sm:grid-cols-2"
        >
          <label className="grid gap-1.5">
            <span className="eyebrow text-[0.45rem] text-ink-soft">Member</span>
            <select
              value={taskUser}
              onChange={(event) => setTaskUser(event.target.value)}
              data-testid="admin-task-member"
              className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
            >
              <option value="">Choose a member</option>
              {(overview?.investors ?? []).map((investor) => (
                <option key={investor.userId} value={investor.userId}>
                  {investor.name} · Level {investor.level}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5">
            <span className="eyebrow text-[0.45rem] text-ink-soft">Unlocks level</span>
            <select
              value={taskLevel}
              onChange={(event) => setTaskLevel(Number(event.target.value))}
              data-testid="admin-task-level"
              className="w-full border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.level} value={option.level}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow text-[0.45rem] text-ink-soft">Task title</span>
            <input
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              data-testid="admin-task-title"
              placeholder="Fund the first project deposit"
              className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </label>
          <label className="grid gap-1.5 sm:col-span-2">
            <span className="eyebrow text-[0.45rem] text-ink-soft">What the member has to do</span>
            <textarea
              value={taskDetail}
              onChange={(event) => setTaskDetail(event.target.value)}
              data-testid="admin-task-detail"
              rows={3}
              className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled={taskBusy}
              data-testid="admin-task-assign"
              className="eyebrow bg-primary px-5 py-3 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
            >
              {taskBusy ? 'Assigning…' : 'Assign task'}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-end gap-4 border-b border-border px-6 py-4">
          <label className="grid gap-1.5">
            <span className="eyebrow text-[0.45rem] text-ink-soft">Status</span>
            <select
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value as typeof taskFilter)}
              data-testid="admin-tasks-filter"
              className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
            >
              <option value="all">All tasks</option>
              <option value="submitted">Waiting for approval</option>
              <option value="pending">To do</option>
              <option value="approved">Approved</option>
              <option value="rejected">Sent back</option>
            </select>
          </label>
          <p data-testid="admin-tasks-count" className="pb-2 text-xs text-ink-soft">
            {adminTasks === undefined
              ? 'Loading…'
              : `${filteredTasks.length} of ${adminTasks.length} tasks`}
          </p>
        </div>

        {adminTasks === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading tasks…</p>
        ) : filteredTasks.length === 0 ? (
          <p data-testid="admin-tasks-empty" className="px-6 py-6 text-sm text-ink-soft">
            {adminTasks.length === 0 ? 'No tasks assigned yet.' : 'No tasks match this status.'}
          </p>
        ) : (
          <ul data-testid="admin-tasks" className="divide-y divide-border">
            {filteredTasks.map((task) => (
              <li key={task.id} data-testid={`admin-task-${task.id}`} className="px-6 py-5">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div>
                    <p className="display text-base">{task.title}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {task.name} · {task.email || 'no email'} · unlocks {task.targetLevelName}
                    </p>
                  </div>
                  <span data-testid={`admin-task-status-${task.id}`} className="eyebrow text-[0.45rem] text-brass">
                    {task.status}
                  </span>
                </div>
                {task.detail ? <p className="mt-3 text-sm text-ink-soft">{task.detail}</p> : null}
                <label className="mt-4 grid gap-1.5">
                  <span className="eyebrow text-[0.45rem] text-ink-soft">Reason (shown to the member when sent back)</span>
                  <input
                    value={taskReasons[task.id] ?? ''}
                    onChange={(event) =>
                      setTaskReasons((current) => ({ ...current, [task.id]: event.target.value }))
                    }
                    data-testid={`admin-task-reason-${task.id}`}
                    placeholder="Add the missing deposit receipt"
                    className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                  />
                </label>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      decideTask({ id: task.id, decision: 'approve' })
                        .then(() => setNotice(`${task.name} unlocked ${task.targetLevelName}.`))
                        .catch((err) => setError(errorMessage(err, 'Could not approve that task')))
                    }
                    data-testid={`admin-task-approve-${task.id}`}
                    className="eyebrow border border-brass px-4 py-2 text-[0.45rem] transition-colors hover:bg-brass/10"
                  >
                    Approve and unlock
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      decideTask({ id: task.id, decision: 'reject', note: taskReasons[task.id]?.trim() || undefined })
                        .then(() => {
                          setNotice(`${task.name} needs to try that task again.`)
                          setTaskReasons((current) => ({ ...current, [task.id]: '' }))
                        })
                        .catch((err) => setError(errorMessage(err, 'Could not reject that task')))
                    }
                    data-testid={`admin-task-reject-${task.id}`}
                    className="eyebrow border border-border px-4 py-2 text-[0.45rem] text-ink-soft transition-colors hover:border-brass"
                  >
                    Send back
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      removeTask({ id: task.id })
                        .then(() => setNotice('Task removed.'))
                        .catch((err) => setError(errorMessage(err, 'Could not remove that task')))
                    }
                    data-testid={`admin-task-remove-${task.id}`}
                    className="eyebrow border border-destructive/50 px-4 py-2 text-[0.45rem] text-destructive transition-colors hover:bg-destructive/5"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="deposits" style={{ display: sectionShown('deposits') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Bank deposits</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Bank transfers recorded by customers, with date and time, reference and status.
          </p>
        </div>
        {depositRecords === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading deposits…</p>
        ) : depositRecords.length === 0 ? (
          <p data-testid="admin-deposits-empty" className="px-6 py-6 text-sm text-ink-soft">
            No bank deposits yet.
          </p>
        ) : (
          <div data-testid="admin-deposits" className="overflow-x-auto">
            <table className="w-full min-w-[48rem] text-left text-sm">
              <thead>
                <tr className="eyebrow text-[0.45rem] text-ink-soft">
                  <th scope="col" className="px-6 py-3 font-normal">Date and time</th>
                  <th scope="col" className="px-6 py-3 font-normal">Customer</th>
                  <th scope="col" className="px-6 py-3 font-normal">Amount</th>
                  <th scope="col" className="px-6 py-3 font-normal">Method</th>
                  <th scope="col" className="px-6 py-3 font-normal">Reference</th>
                  <th scope="col" className="px-6 py-3 font-normal">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {depositRecords.map((row) => (
                  <tr key={row.id} data-testid={`admin-deposit-${row.id}`}>
                    <td className="px-6 py-3 text-ink-soft">{formatDate(row.createdAt)}</td>
                    <td className="px-6 py-3">
                      {row.name}
                      <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                    </td>
                    <td className="px-6 py-3">{formatAed(row.amountAed)}</td>
                    <td className="px-6 py-3 text-ink-soft">{row.method}</td>
                    <td className="px-6 py-3 text-ink-soft">{row.reference ?? 'None'}</td>
                    <td className="px-6 py-3">
                      <span className="eyebrow text-[0.45rem] text-brass">{row.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section id="commissions" style={{ display: sectionShown('commissions') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Commissions paid</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Commission paid to customers per membership plan, separate from wallet top-ups.
          </p>
        </div>
        <div data-testid="admin-commissions" className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-left text-sm">
            <thead>
              <tr className="eyebrow text-[0.45rem] text-ink-soft">
                <th scope="col" className="px-6 py-3 font-normal">Plan</th>
                <th scope="col" className="px-6 py-3 font-normal">Payments</th>
                <th scope="col" className="px-6 py-3 font-normal">Commission paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(adminPlans?.commissions ?? []).map((row) => (
                <tr key={row.code}>
                  <td className="px-6 py-3">{row.name}</td>
                  <td className="px-6 py-3 text-ink-soft">{row.count}</td>
                  <td className="px-6 py-3">{formatAed(row.paidAed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="crypto" style={{ display: sectionShown('crypto') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="display text-xl">Crypto payments</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Members upload a payment slip. Approving credits the wallet in AED.
            </p>
          </div>
          <span className="eyebrow text-[0.5rem] text-ink-soft">
            {cryptoPayments ? `${cryptoPayments.filter((row) => row.status === 'pending').length} waiting` : 'Loading'}
          </span>
        </div>

        <div data-testid="admin-crypto-filter" className="flex flex-wrap gap-2 border-b border-border px-6 py-3">
          {(['all', 'pending', 'approved', 'rejected'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setCryptoFilter(option)}
              data-testid={`admin-crypto-filter-${option}`}
              data-active={cryptoFilter === option}
              className={`eyebrow border px-3 py-2 text-[0.5rem] transition-colors ${
                cryptoFilter === option
                  ? 'border-brass bg-brass/10 text-ink'
                  : 'border-border text-ink-soft hover:border-brass'
              }`}
            >
              {option === 'all' ? 'All' : option.charAt(0).toUpperCase() + option.slice(1)}
            </button>
          ))}
        </div>

        {cryptoPayments === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading crypto payments…</p>
        ) : cryptoPayments.filter((row) => cryptoFilter === 'all' || row.status === cryptoFilter).length === 0 ? (
          <p data-testid="admin-crypto-empty" className="px-6 py-6 text-sm text-ink-soft">
            No {cryptoFilter === 'all' ? '' : `${cryptoFilter} `}crypto payment slips.
          </p>
        ) : (
          <div data-testid="admin-crypto" className="divide-y divide-border">
            {cryptoPayments
              .filter((row) => cryptoFilter === 'all' || row.status === cryptoFilter)
              .map((row) => (
              <div
                key={row.id}
                data-testid={`admin-crypto-${row.id}`}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm">
                    {row.name}
                    <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.coin} · {row.network} · {formatAed(row.amountAed)} · {row.status}
                    {row.txHash ? ` · ${row.txHash}` : ''}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.proofUrl ? (
                      <a href={row.proofUrl} target="_blank" rel="noreferrer" className="link-underline text-brass">
                        Open payment slip ({row.proofName})
                      </a>
                    ) : (
                      'Slip unavailable'
                    )}
                  </p>
                </div>

                {row.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmError(null)
                        setConfirmAction({
                          title: 'Approve this crypto payment?',
                          detail: `${row.name} · ${row.email}. ${formatAed(row.amountAed)} in ${row.coin} on ${row.network}. Approving credits the wallet immediately and cannot be undone.`,
                          confirmLabel: 'Approve payment',
                          run: async () => {
                            await decideCrypto({ id: row.id, decision: 'approve' })
                            setError(null)
                            setNotice('Crypto payment approved and wallet credited.')
                          },
                        })
                      }}
                      data-testid={`admin-crypto-approve-${row.id}`}
                      className="eyebrow border border-brass bg-brass/10 px-4 py-2.5 text-[0.5rem] transition-colors hover:bg-brass/20"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        runInvestmentAction(
                          () => decideCrypto({ id: row.id, decision: 'reject' }),
                          'Crypto payment rejected.',
                        )
                      }
                      data-testid={`admin-crypto-reject-${row.id}`}
                      className="eyebrow border border-destructive/40 px-4 py-2.5 text-[0.5rem] text-destructive transition-colors hover:bg-destructive/5"
                    >
                      Reject
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>

      <section id="payment-details" style={{ display: sectionShown('payment-details') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Payment details for customers</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. These bank and crypto details appear in the member support page and
            in the crypto payment form.
          </p>
        </div>

        {(() => {
          const draft =
            detailsDraft ?? {
              bankName: savedDetails?.bankName ?? '',
              accountName: savedDetails?.accountName ?? '',
              accountNumber: savedDetails?.accountNumber ?? '',
              iban: savedDetails?.iban ?? '',
              swift: savedDetails?.swift ?? '',
              note: savedDetails?.note ?? '',
              crypto: savedDetails?.crypto ?? [],
            }
          const update = (patch: Partial<typeof draft>) =>
            setDetailsDraft((prev) => ({ ...(prev ?? draft), ...patch }))
          const updateCrypto = (
            index: number,
            patch: Partial<{ coin: string; network: string; address: string }>,
          ) =>
            setDetailsDraft((prev) => {
              const base = prev ?? draft
              const next = [...base.crypto]
              next[index] = { ...next[index], ...patch }
              return { ...base, crypto: next }
            })
          return (
            <form
              data-testid="admin-details-form"
              className="grid gap-4 px-6 py-5 sm:grid-cols-2"
              onSubmit={async (event) => {
                event.preventDefault()
                setError(null)
                setNotice(null)
                try {
                  await savePaymentDetails({
                    bankName: draft.bankName,
                    accountName: draft.accountName,
                    accountNumber: draft.accountNumber,
                    iban: draft.iban,
                    swift: draft.swift,
                    note: draft.note,
                    crypto: draft.crypto,
                  })
                  setNotice('Payment details saved.')
                } catch (err) {
                  setError(errorMessage(err, 'Could not save the payment details'))
                }
              }}
            >
              {[
                { key: 'bankName', label: 'Bank name' },
                { key: 'accountName', label: 'Account name' },
                { key: 'accountNumber', label: 'Account number' },
                { key: 'iban', label: 'IBAN' },
                { key: 'swift', label: 'SWIFT' },
              ].map((field) => (
                <label key={field.key} className="block">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">{field.label}</span>
                  <input
                    type="text"
                    value={draft[field.key as 'bankName']}
                    onChange={(event) => update({ [field.key]: event.target.value } as never)}
                    data-testid={`admin-detail-${field.key}`}
                    className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
                  />
                </label>
              ))}

              <label className="block sm:col-span-2">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Note for members</span>
                <input
                  type="text"
                  value={draft.note}
                  onChange={(event) => update({ note: event.target.value })}
                  placeholder="Deposits are credited after administration approval"
                  data-testid="admin-detail-note"
                  className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
                />
              </label>

              <div className="sm:col-span-2">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Crypto wallets</p>
                <ul data-testid="admin-crypto-wallets" className="mt-2 grid gap-3">
                  {draft.crypto.map((row, index) => (
                    <li key={`${row.coin}-${index}`} className="grid gap-2 sm:grid-cols-[8rem_10rem_1fr_auto]">
                      <input
                        type="text"
                        value={row.coin}
                        placeholder="USDT"
                        onChange={(event) => updateCrypto(index, { coin: event.target.value })}
                        data-testid={`admin-crypto-coin-${index}`}
                        className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                      <input
                        type="text"
                        value={row.network}
                        placeholder="TRC20"
                        onChange={(event) => updateCrypto(index, { network: event.target.value })}
                        data-testid={`admin-crypto-network-${index}`}
                        className="border border-input bg-background px-3 py-2 text-sm outline-none focus:border-brass"
                      />
                      <input
                        type="text"
                        value={row.address}
                        placeholder="Wallet address"
                        onChange={(event) => updateCrypto(index, { address: event.target.value })}
                        data-testid={`admin-crypto-address-${index}`}
                        className="border border-input bg-background px-3 py-2 font-mono text-xs outline-none focus:border-brass"
                      />
                      <button
                        type="button"
                        onClick={() => update({ crypto: draft.crypto.filter((_, i) => i !== index) })}
                        data-testid={`admin-crypto-remove-${index}`}
                        className="eyebrow border border-destructive/40 px-3 py-2 text-[0.45rem] text-destructive"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    update({ crypto: [...draft.crypto, { coin: '', network: '', address: '' }] })
                  }
                  data-testid="admin-crypto-add"
                  className="eyebrow mt-3 border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                >
                  Add crypto wallet
                </button>
              </div>

              <div className="sm:col-span-2">
                <button
                  type="submit"
                  data-testid="admin-details-save"
                  className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Save payment details
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </form>
          )
        })()}
      </section>

      <section id="plans" style={{ display: sectionShown('plans') ? undefined : 'none' }} className="min-w-0 scroll-mt-24 border border-card bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Membership plans</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. Minimum amounts, profit and commission apply to every investment
            funded after saving.
          </p>
        </div>
        <div data-testid="admin-plans" className="w-full overflow-x-auto">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead>
              <tr className="eyebrow text-[0.45rem] text-ink-soft">
                <th scope="col" className="px-6 py-3 font-normal">Plan</th>
                <th scope="col" className="px-6 py-3 font-normal">Minimum AED</th>
                <th scope="col" className="px-6 py-3 font-normal">Profit %</th>
                <th scope="col" className="px-6 py-3 font-normal">Commission %</th>
                <th scope="col" className="px-6 py-3 font-normal">Commission paid</th>
                <th scope="col" className="px-6 py-3 font-normal">Active</th>
                <th scope="col" className="sticky right-0 border-l border-border bg-card px-4 py-3 font-normal">Save</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(adminPlans?.plans ?? []).map((plan) => {
                const draft = planDrafts[plan.code] ?? {
                  minAed: String(plan.minAed),
                  profit: String(plan.profitPercent),
                  commission: String(plan.commissionPercent),
                  active: plan.active,
                }
                const paid = adminPlans?.commissions.find((row) => row.code === plan.code)
                return (
                  <tr key={plan.code} data-testid={`admin-plan-${plan.code}`}>
                    <td className="px-6 py-3">
                      {plan.name}
                      <span className="ml-2 text-xs text-ink-soft">level {plan.level}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null)
                          setNotice(null)
                          try {
                            await savePlan({
                              code: plan.code,
                              minAed: Number(draft.minAed),
                              profitPercent: Number(draft.profit),
                              commissionPercent: Number(draft.commission),
                              active: draft.active,
                            })
                            setNotice(`${plan.name} saved.`)
                          } catch (err) {
                            setError(errorMessage(err, 'Could not save the plan'))
                          }
                        }}
                        data-testid={`admin-plan-apply-${plan.code}`}
                        className="eyebrow mt-2 block border border-brass px-3 py-1.5 text-[0.45rem] transition-colors hover:bg-brass/10"
                      >
                        Apply changes
                      </button>
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        value={draft.minAed}
                        onChange={(event) =>
                          setPlanDrafts({
                            ...planDrafts,
                            [plan.code]: { ...draft, minAed: event.target.value },
                          })
                        }
                        data-testid={`admin-plan-min-${plan.code}`}
                        className="w-28 border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.1"
                        value={draft.profit}
                        onChange={(event) =>
                          setPlanDrafts({
                            ...planDrafts,
                            [plan.code]: { ...draft, profit: event.target.value },
                          })
                        }
                        data-testid={`admin-plan-profit-${plan.code}`}
                        className="w-20 border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
                      />
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={draft.commission}
                        onChange={(event) =>
                          setPlanDrafts({
                            ...planDrafts,
                            [plan.code]: { ...draft, commission: event.target.value },
                          })
                        }
                        data-testid={`admin-plan-commission-${plan.code}`}
                        className="w-20 border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
                      />
                    </td>
                    <td className="px-6 py-3 text-xs text-ink-soft">
                      {paid ? `${formatAed(paid.paidAed)} · ${paid.count} payments` : 'AED 0.00'}
                    </td>
                    <td className="px-6 py-3">
                      <input
                        type="checkbox"
                        checked={draft.active}
                        onChange={(event) =>
                          setPlanDrafts({
                            ...planDrafts,
                            [plan.code]: { ...draft, active: event.target.checked },
                          })
                        }
                        data-testid={`admin-plan-active-${plan.code}`}
                        aria-label={`${plan.name} active`}
                      />
                    </td>
                    <td className="sticky right-0 border-l border-border bg-card px-4 py-3">
                      <button
                        type="button"
                        onClick={async () => {
                          setError(null)
                          setNotice(null)
                          try {
                            await savePlan({
                              code: plan.code,
                              minAed: Number(draft.minAed),
                              profitPercent: Number(draft.profit),
                              commissionPercent: Number(draft.commission),
                              active: draft.active,
                            })
                            setNotice(`${plan.name} saved.`)
                          } catch (err) {
                            setError(errorMessage(err, 'Could not save the plan'))
                          }
                        }}
                        data-testid={`admin-plan-save-${plan.code}`}
                        className="eyebrow border border-border px-4 py-2 text-[0.5rem] transition-colors hover:border-brass"
                      >
                        Save
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section id="balances" style={{ display: sectionShown('balances') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Member wallet balance</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. Credit adds funds, debit removes funds, and both appear in the
            member ledger.
          </p>
        </div>
        <form
          className="grid gap-4 px-6 py-5 sm:grid-cols-2"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            setNotice(null)
            if (!balanceDraft.userId) {
              setError('Choose a member')
              return
            }
            const amountAed = Number(balanceDraft.amount)
            if (!Number.isFinite(amountAed) || amountAed <= 0) {
              setError('Enter an amount above zero')
              return
            }
            const member = overview.investors.find((row) => row.userId === balanceDraft.userId)
            const directionLabel = balanceDraft.direction === 'credit' ? 'Credit' : 'Debit'
            setConfirmError(null)
            setConfirmAction({
              title: `${directionLabel} this member wallet?`,
              detail: `${directionLabel} ${formatAed(amountAed)} ${balanceDraft.direction === 'credit' ? 'to' : 'from'} ${member?.name ?? 'the selected member'}${member?.email ? ` (${member.email})` : ''}. Current balance ${formatAed(member?.balanceAed ?? 0)}. This entry is written to the member ledger and cannot be undone.`,
              confirmLabel: `${directionLabel} ${formatAed(amountAed)}`,
              run: async () => {
                await adjustBalance({
                  userId: balanceDraft.userId as never,
                  direction: balanceDraft.direction,
                  amountAed,
                  note: balanceDraft.note || undefined,
                })
                setBalanceDraft({ ...balanceDraft, amount: '', note: '' })
                setError(null)
                setNotice('Wallet balance updated.')
              },
            })
          }}
        >
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Member</span>
            <select
              value={balanceDraft.userId}
              onChange={(event) => setBalanceDraft({ ...balanceDraft, userId: event.target.value })}
              data-testid="admin-balance-member"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            >
              <option value="">Choose a member</option>
              {overview.investors.map((investor) => (
                <option key={investor.userId} value={investor.userId}>
                  {investor.name} · {investor.email} · {formatAed(investor.balanceAed)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Direction</span>
            <select
              value={balanceDraft.direction}
              onChange={(event) =>
                setBalanceDraft({
                  ...balanceDraft,
                  direction: event.target.value as 'credit' | 'debit',
                })
              }
              data-testid="admin-balance-direction"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            >
              <option value="credit">Credit (add funds)</option>
              <option value="debit">Debit (remove funds)</option>
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Amount in AED</span>
            <input
              type="number"
              min={1}
              step={100}
              required
              value={balanceDraft.amount}
              onChange={(event) => setBalanceDraft({ ...balanceDraft, amount: event.target.value })}
              data-testid="admin-balance-amount"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Note</span>
            <input
              type="text"
              value={balanceDraft.note}
              onChange={(event) => setBalanceDraft({ ...balanceDraft, note: event.target.value })}
              placeholder="Plan upgrade, correction"
              data-testid="admin-balance-note"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="admin-balance-submit"
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Update balance
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </section>

      <section id="levels" style={{ display: sectionShown('levels') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Investment levels</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Members move up automatically as funded investments grow. Profit and commission are paid
            into the wallet with each approved investment.
          </p>
        </div>
        <div data-testid="admin-ranks" className="overflow-x-auto">
          <table className="w-full min-w-[38rem] text-left text-sm">
            <thead>
              <tr className="eyebrow text-[0.45rem] text-ink-soft">
                <th scope="col" className="px-6 py-3 font-normal">Num</th>
                <th scope="col" className="px-6 py-3 font-normal">Level</th>
                <th scope="col" className="px-6 py-3 font-normal">Minimum</th>
                <th scope="col" className="px-6 py-3 font-normal">Profit %</th>
                <th scope="col" className="px-6 py-3 font-normal">Commission %</th>
                <th scope="col" className="px-6 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(adminPlans?.plans ?? []).map((rank) => (
                <tr key={rank.code} data-testid={`admin-rank-${rank.code}`}>
                  <td className="px-6 py-3 text-ink-soft">{rank.level}</td>
                  <td className="px-6 py-3">{rank.name}</td>
                  <td className="px-6 py-3">{formatAed(rank.minAed)}</td>
                  <td className="px-6 py-3">{rank.profitPercent.toFixed(2)}</td>
                  <td className="px-6 py-3">{rank.commissionPercent.toFixed(2)}</td>
                  <td className="px-6 py-3">
                    <span className="eyebrow border border-brass/50 bg-brass/10 px-2 py-1 text-[0.45rem] text-brass">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="level-profit" style={{ display: sectionShown('level-profit') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Monthly profit by level</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. Each membership level pays its own monthly profit percentage on the
            member balance. Changes apply to the next monthly payout run.
          </p>
        </div>
        <div data-testid="admin-level-profit" className="divide-y divide-border">
          {(adminPlans?.plans ?? []).map((plan) => {
            const value = profitDrafts[plan.code] ?? String(plan.profitPercent)
            return (
              <div
                key={plan.code}
                data-testid={`admin-level-profit-row-${plan.level}`}
                className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm">
                    Level {plan.level} · {plan.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {plan.active ? 'Active' : 'Inactive'} · commission {plan.commissionPercent}%
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="eyebrow text-[0.45rem] text-ink-soft" htmlFor={`profit-${plan.level}`}>
                    Profit %
                  </label>
                  <input
                    id={`profit-${plan.level}`}
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={value}
                    onChange={(event) =>
                      setProfitDrafts({ ...profitDrafts, [plan.code]: event.target.value })
                    }
                    data-testid={`admin-profit-input-${plan.level}`}
                    className="w-24 border border-input bg-background px-2 py-1.5 text-sm outline-none focus:border-brass"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null)
                      setNotice(null)
                      try {
                        await setLevelProfit({
                          level: plan.level,
                          profitPercent: Number(value),
                        })
                        setProfitDrafts({ ...profitDrafts, [plan.code]: String(Number(value)) })
                        setNotice(`Level ${plan.level} profit set to ${Number(value)}%.`)
                      } catch (err) {
                        setError(errorMessage(err, 'Could not save the profit percentage'))
                      }
                    }}
                    data-testid={`admin-profit-save-${plan.level}`}
                    className="eyebrow border border-border px-4 py-2 text-[0.5rem] transition-colors hover:border-brass"
                  >
                    Save
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section id="topups" style={{ display: sectionShown('topups') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <h2 className="display text-xl">Pending top-ups</h2>
          <span className="eyebrow text-[0.5rem] text-ink-soft">{overview.pendingTopUps.length} waiting</span>
        </div>
        {overview.pendingTopUps.length === 0 ? (
          <p className="px-6 py-6 text-sm text-ink-soft">No top-ups waiting for approval.</p>
        ) : (
          <ul data-testid="admin-pending-topups" className="divide-y divide-border">
            {overview.pendingTopUps.map((row) => (
              <li key={row.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="display text-lg">{formatAed(row.amountAed)}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.name} · {row.email} · {row.mobile || 'no mobile'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.method}
                    {row.reference ? ` · ${row.reference}` : ''}
                    {row.residence ? ` · ${row.residence}` : ''} · {formatDate(row.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => reviewTopUp(row.id, true)}
                    data-testid={`topup-approve-${row.id}`}
                    className="eyebrow bg-primary px-4 py-2.5 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => reviewTopUp(row.id, false)}
                    data-testid={`topup-reject-${row.id}`}
                    className="eyebrow border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                  >
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="withdrawals" style={{ display: sectionShown('withdrawals') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="display text-xl">Withdrawals</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Release or reject pending requests, or review completed and rejected ones.
            </p>
          </div>
          <label className="flex items-center gap-2">
            <span className="eyebrow text-[0.45rem] text-ink-soft">Status</span>
            <select
              value={withdrawalFilter}
              onChange={(event) =>
                setWithdrawalFilter(event.target.value as 'all' | 'pending' | 'completed' | 'rejected')
              }
              data-testid="admin-withdrawals-filter"
              className="border border-input bg-background px-3 py-2 text-xs outline-none focus:border-brass"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="all">All</option>
            </select>
          </label>
          <span className="eyebrow text-[0.5rem] text-ink-soft">{overview.pendingWithdrawals.length} waiting</span>
        </div>
        <p data-testid="admin-withdrawals-count" className="border-b border-border px-6 py-3 text-xs text-ink-soft">
          {withdrawalRows.length} {withdrawalRows.length === 1 ? 'withdrawal' : 'withdrawals'} shown
        </p>
        {withdrawalRows.length === 0 ? (
          <p data-testid="admin-withdrawals-empty" className="px-6 py-6 text-sm text-ink-soft">
            No withdrawals match this status.
          </p>
        ) : (
          <ul data-testid="admin-withdrawals-list" className="divide-y divide-border">
            {withdrawalRows.map((row) => (
              <li key={row.id} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="display text-lg">{formatAed(row.amountAed)}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {row.name} · {row.email} · {row.iban.slice(-4).padStart(row.iban.length, '•')}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">{formatDate(row.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {row.status === 'pending' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => reviewWithdrawal(row.id, true)}
                        data-testid={`withdrawal-approve-${row.id}`}
                        className="eyebrow bg-primary px-4 py-2.5 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
                      >
                        Release
                      </button>
                      <button
                        type="button"
                        onClick={() => reviewWithdrawal(row.id, false)}
                        data-testid={`withdrawal-reject-${row.id}`}
                        className="eyebrow border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <span
                      data-testid={`withdrawal-status-${row.id}`}
                      className="eyebrow border border-border px-3 py-2 text-[0.45rem] text-ink-soft"
                    >
                      {row.status}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="investors" style={{ display: sectionShown('investors') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <h2 className="display text-xl">Investors</h2>
          <span className="eyebrow text-[0.5rem] text-ink-soft">{overview.investors.length} members</span>
        </div>
        {overview.investors.length === 0 ? (
          <p className="px-6 py-6 text-sm text-ink-soft">No members yet.</p>
        ) : filteredInvestors.length === 0 ? (
          <p data-testid="admin-investors-empty" className="px-6 py-6 text-sm text-ink-soft">
            No members match “{usersQuery}”.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table data-testid="admin-investors" className="w-full min-w-[46rem] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-ink-soft">
                  <th className="px-6 py-3 font-normal">Member</th>
                  <th className="px-4 py-3 font-normal">Level</th>
                  <th className="px-4 py-3 font-normal">Top-ups</th>
                  <th className="px-4 py-3 font-normal">Wallet balance</th>
                  <th className="px-4 py-3 font-normal">Pending</th>
                  <th className="px-4 py-3 font-normal">Standing</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvestors.map((row) => (
                  <tr key={row.userId} className="border-b border-border/60 last:border-0">
                    <td className="px-6 py-4">
                      <p>{row.name}</p>
                      <p className="mt-1 text-xs text-ink-soft">{row.email}</p>
                      <p className="text-xs text-ink-soft">{row.mobile || 'no mobile'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={row.level}
                        onChange={(event) => {
                          const level = Number(event.target.value)
                          setMemberLevel({ userId: row.userId as never, level })
                            .then(() => setNotice(`${row.name} is now Level ${level}.`))
                            .catch((err) => setError(errorMessage(err, 'Could not change the level')))
                        }}
                        data-testid={`admin-investor-level-${row.userId}`}
                        aria-label={`Membership level for ${row.name}`}
                        className="border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-brass"
                      >
                        {LEVEL_OPTIONS.map((option) => (
                          <option key={option.level} value={option.level}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1 text-xs text-ink-soft">{row.tierName}</p>
                    </td>
                    <td className="px-4 py-4">{formatAed(row.totalTopUpAed)}</td>
                    <td className="px-4 py-4">{formatAed(row.balanceAed)}</td>
                    <td className="px-4 py-4 text-ink-soft">
                      {row.pendingTopUpAed > 0 ? `Top-up ${formatAed(row.pendingTopUpAed)}` : ''}
                      {row.pendingWithdrawalAed > 0 ? `Withdrawal ${formatAed(row.pendingWithdrawalAed)}` : ''}
                      {row.pendingTopUpAed === 0 && row.pendingWithdrawalAed === 0 ? '—' : ''}
                    </td>
                    <td className="px-4 py-4">
                      {(() => {
                        const state = accountStates?.find((item) => item.userId === row.userId)
                        const status = state?.status ?? 'active'
                        return (
                          <div className="grid gap-2">
                            <span
                              data-testid={`admin-standing-${row.userId}`}
                              className={[
                                'eyebrow w-fit px-2 py-1 text-[0.45rem]',
                                status === 'active'
                                  ? 'border border-border text-ink-soft'
                                  : status === 'frozen'
                                    ? 'border border-brass/60 text-brass'
                                    : 'border border-destructive/50 text-destructive',
                              ].join(' ')}
                            >
                              {status}
                            </span>
                            <select
                              value={status}
                              onChange={(event) =>
                                changeState(
                                  row.userId,
                                  event.target.value as 'active' | 'frozen' | 'blocked',
                                )
                              }
                              data-testid={`admin-state-${row.userId}`}
                              className="border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-brass"
                            >
                              <option value="active">Active</option>
                              <option value="frozen">Frozen assets</option>
                              <option value="blocked">Blocked</option>
                            </select>
                          </div>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        id="passcode"
        style={{ display: sectionShown('passcode') ? undefined : 'none' }}
        className="scroll-mt-24 border border-border bg-card"
      >
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Admin passcode</h2>
          <p className="mt-1 text-xs text-ink-soft">
            The passcode locks the admin centre for every administrator. Changing it asks for the
            current passcode and applies to new unlocks.
          </p>
          <p className="mt-2 text-xs text-ink-soft">
            {passcodeStatus === undefined
              ? 'Checking the current passcode…'
              : passcodeStatus.custom
                ? 'A custom passcode is in use.'
                : 'The default passcode is still in use.'}
          </p>
        </div>
        <form
          className="grid gap-4 px-6 py-5 sm:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            setNotice(null)
            setPasscodeMessage('')
            if (passcodeDraft.next.trim().length < 8) {
              setPasscodeState('error')
              setPasscodeMessage('The new passcode needs at least 8 characters')
              return
            }
            if (passcodeDraft.next !== passcodeDraft.repeat) {
              setPasscodeState('error')
              setPasscodeMessage('The two new passcodes do not match')
              return
            }
            setPasscodeState('saving')
            try {
              await changePasscode({
                current: passcodeDraft.current,
                next: passcodeDraft.next,
              })
              setPasscodeDraft({ current: '', next: '', repeat: '' })
              setPasscodeState('saved')
              setPasscodeMessage('Admin passcode updated.')
            } catch (err) {
              setPasscodeState('error')
              setPasscodeMessage(errorMessage(err, 'Could not change the passcode'))
            }
          }}
        >
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Current passcode</span>
            <input
              type="password"
              autoComplete="current-password"
              value={passcodeDraft.current}
              onChange={(event) =>
                setPasscodeDraft({ ...passcodeDraft, current: event.target.value })
              }
              data-testid="admin-passcode-current"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">New passcode</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passcodeDraft.next}
              onChange={(event) => setPasscodeDraft({ ...passcodeDraft, next: event.target.value })}
              data-testid="admin-passcode-next"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Repeat new passcode</span>
            <input
              type="password"
              autoComplete="new-password"
              value={passcodeDraft.repeat}
              onChange={(event) =>
                setPasscodeDraft({ ...passcodeDraft, repeat: event.target.value })
              }
              data-testid="admin-passcode-repeat"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>

          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={passcodeState === 'saving'}
              data-testid="admin-passcode-save"
              data-state={passcodeState}
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
            >
              {passcodeState === 'saving' ? 'Saving' : 'Change passcode'}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            {passcodeMessage ? (
              <p
                role={passcodeState === 'error' ? 'alert' : undefined}
                data-testid="admin-passcode-message"
                className={`mt-3 text-sm ${passcodeState === 'error' ? 'text-destructive' : 'text-ink-soft'}`}
              >
                {passcodeMessage}
              </p>
            ) : null}
          </div>
        </form>
      </section>

      <section id="alerts" style={{ display: sectionShown('alerts') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <div>
            <h2 className="display text-xl">Alerts</h2>
            <p className="mt-1 text-xs text-ink-soft">
              New top-ups, withdrawals and support messages arrive here.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span data-testid="admin-unread" className="eyebrow text-[0.5rem] text-brass">
              {overview.unreadNotifications} unread
            </span>
            <button
              type="button"
              onClick={clearAlerts}
              data-testid="admin-alerts-clear"
              className="eyebrow border border-border px-4 py-2 text-[0.5rem] transition-colors hover:border-brass"
            >
              Mark read
            </button>
          </div>
        </div>
        {overview.notifications.length === 0 ? (
          <p className="px-6 py-6 text-sm text-ink-soft">No alerts yet.</p>
        ) : (
          <ul data-testid="admin-alerts" className="divide-y divide-border">
            {overview.notifications.map((row) => (
              <li key={row.id} className="flex items-start gap-4 px-6 py-4">
                <span
                  aria-hidden="true"
                  className={[
                    'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                    row.read ? 'bg-ink/20' : 'bg-brass',
                  ].join(' ')}
                />
                <div>
                  <p className="text-sm">{row.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">{row.body}</p>
                  <p className="mt-1 text-xs text-ink-soft">{formatDate(row.createdAt)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

<section id="support" style={{ display: sectionShown('support') ? undefined : 'none' }} className="border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Customer service chat</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Every member conversation, answered from here.
          </p>
        </div>
        <div className="grid gap-0 lg:grid-cols-12">
          <div className="border-b border-border lg:col-span-5 lg:border-b-0 lg:border-r">
            {adminThreads === undefined ? (
              <p className="px-6 py-6 text-sm text-ink-soft">Loading conversations…</p>
            ) : adminThreads.length === 0 ? (
              <p className="px-6 py-6 text-sm text-ink-soft">No member messages yet.</p>
            ) : (
              <ul data-testid="admin-support-threads" className="divide-y divide-border">
                {adminThreads.map((row) => (
                  <li key={row.threadId}>
                    <button
                      type="button"
                      onClick={() => setActiveThreadId(row.threadId)}
                      data-testid={`admin-thread-${row.threadId}`}
                      className={[
                        'w-full px-6 py-4 text-left transition-colors',
                        activeThreadId === row.threadId ? 'bg-bone/60' : 'hover:bg-bone/40',
                      ].join(' ')}
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm">{row.name}</span>
                        {row.unreadForAdmin > 0 ? (
                          <span className="eyebrow bg-brass px-2 py-1 text-[0.45rem] text-deep">
                            {row.unreadForAdmin}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-soft">{row.lastMessage}</span>
                      <span className="mt-1 block text-xs text-ink-soft">{row.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lg:col-span-7">
            {!activeThreadId ? (
              <p className="px-6 py-6 text-sm text-ink-soft">Select a conversation to read and reply.</p>
            ) : (
              <div data-testid="admin-support-thread" className="flex flex-col">
                <div className="max-h-[22rem] space-y-3 overflow-y-auto px-6 py-5">
                  {(threadMessages ?? []).map((message) => (
                    <div
                      key={message.id}
                      className={message.authorRole === 'admin' ? 'flex justify-end' : 'flex justify-start'}
                    >
                      <div
                        className={[
                          'max-w-[85%] px-4 py-3 text-sm leading-relaxed',
                          message.authorRole === 'admin'
                            ? 'bg-primary text-primary-foreground'
                            : 'border border-border bg-background',
                        ].join(' ')}
                      >
                        <p className="eyebrow text-[0.45rem] opacity-70">
                          {message.authorRole === 'admin' ? 'You' : 'Member'} · {formatDate(message.createdAt)}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                        <button
                          type="button"
                          onClick={() => deleteMessage(message.id)}
                          data-testid={`admin-message-delete-${message.id}`}
                          className="eyebrow mt-2 text-[0.45rem] text-current opacity-60 underline-offset-4 transition-opacity hover:underline hover:opacity-100"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendReply} className="border-t border-border px-6 py-4">
                  <label className="block">
                    <span className="eyebrow text-[0.5rem] text-ink-soft">Reply as administration</span>
                    <textarea
                      rows={3}
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Write a reply"
                      data-testid="admin-reply-input"
                      className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass"
                    />
                  </label>
                  <button
                    type="submit"
                    data-testid="admin-reply-send"
                    className="eyebrow mt-3 inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
                  >
                    Send reply
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="promotions" style={{ display: sectionShown('promotions') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Offers and promotions</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. A live offer appears as a badge on the residences page and as a
            banner on that residence page.
          </p>
        </div>
        <form onSubmit={publishOffer} data-testid="admin-offer-form" className="grid gap-4 border-b border-border p-6 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Listing</span>
            <select
              value={offer.slug}
              onChange={(event) => setOffer({ ...offer, slug: event.target.value })}
              data-testid="admin-offer-listing"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            >
              {RESIDENCES.map((residence) => (
                <option key={residence.slug} value={residence.slug}>
                  {residence.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Offer headline</span>
            <input
              type="text"
              required
              value={offer.title}
              onChange={(event) => setOffer({ ...offer, title: event.target.value })}
              placeholder="5% off list price this month"
              data-testid="admin-offer-title"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Details (optional)</span>
            <input
              type="text"
              value={offer.detail}
              onChange={(event) => setOffer({ ...offer, detail: event.target.value })}
              placeholder="Valid until 31 December, on selected units"
              data-testid="admin-offer-detail"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="admin-offer-submit"
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Publish offer
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {promotions === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading offers…</p>
        ) : promotions.length === 0 ? (
          <p data-testid="admin-offers-empty" className="px-6 py-6 text-sm text-ink-soft">
            No offers yet. Published offers appear on the public site straight away.
          </p>
        ) : (
          <ul data-testid="admin-offers" className="divide-y divide-border">
            {promotions.map((row) => (
              <li key={row.promotionId} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">{row.title}</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {RESIDENCES.find((item) => item.slug === row.slug)?.name ?? row.slug}
                    {row.detail ? ` · ${row.detail}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={[
                      'eyebrow px-2 py-1 text-[0.45rem]',
                      row.active ? 'bg-brass text-deep' : 'border border-border text-ink-soft',
                    ].join(' ')}
                  >
                    {row.active ? 'Live' : 'Paused'}
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleOffer(row.promotionId, !row.active)}
                    data-testid={`admin-offer-toggle-${row.promotionId}`}
                    className="eyebrow border border-border px-3 py-2 text-[0.45rem] transition-colors hover:border-brass"
                  >
                    {row.active ? 'Pause' : 'Publish'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeOffer(row.promotionId)}
                    data-testid={`admin-offer-delete-${row.promotionId}`}
                    className="eyebrow border border-border px-3 py-2 text-[0.45rem] transition-colors hover:border-destructive hover:text-destructive"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="verifications" style={{ display: sectionShown('verifications') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Identity checks</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. Members upload a government document before their first payment;
            payments stay locked until a document is approved here.
          </p>
        </div>
        {verifications === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading identity checks…</p>
        ) : verifications.length === 0 ? (
          <p data-testid="admin-verifications-empty" className="px-6 py-6 text-sm text-ink-soft">
            No documents waiting for approval.
          </p>
        ) : (
          <ul data-testid="admin-verifications" className="divide-y divide-border">
            {verifications.map((row) => (
              <li key={row.verificationId} className="grid gap-4 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">{row.name}</p>
                    <p className="mt-1 text-xs text-ink-soft">{row.email}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {row.documentType} · {row.documentName} · {formatDate(row.submittedAt)}
                    </p>
                    {row.note ? <p className="mt-1 text-xs text-ink-soft">Note: {row.note}</p> : null}
                  </div>
                  {row.documentUrl ? (
                    <a
                      href={row.documentUrl}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`admin-verify-document-${row.verificationId}`}
                      className="eyebrow link-underline text-[0.5rem] text-brass"
                    >
                      Open document
                      <ArrowRight className="h-3 w-3" />
                    </a>
                  ) : (
                    <span className="text-xs text-ink-soft">Document unavailable</span>
                  )}
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={verifyNotes[row.verificationId] ?? ''}
                    onChange={(event) =>
                      setVerifyNotes({ ...verifyNotes, [row.verificationId]: event.target.value })
                    }
                    placeholder="Reason, if rejecting"
                    data-testid={`admin-verify-note-${row.verificationId}`}
                    className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-brass sm:max-w-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => decideIdentity(row.verificationId, 'approved')}
                      data-testid={`admin-verify-approve-${row.verificationId}`}
                      className="eyebrow bg-primary px-5 py-2.5 text-[0.5rem] text-primary-foreground transition-colors hover:bg-ink/85"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => decideIdentity(row.verificationId, 'rejected')}
                      data-testid={`admin-verify-reject-${row.verificationId}`}
                      className="eyebrow border border-border px-5 py-2.5 text-[0.5rem] transition-colors hover:border-destructive hover:text-destructive"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

<section id="record-payment" style={{ display: sectionShown('record-payment') ? undefined : 'none' }} className="border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Record a payment</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. The amount is credited to the member wallet straight away and
            counts towards their membership level.
          </p>
        </div>
        <form onSubmit={submitPayment} data-testid="admin-payment-form" className="grid gap-4 p-6 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Member</span>
            <select
              value={payment.userId}
              onChange={(event) => setPayment({ ...payment, userId: event.target.value })}
              data-testid="admin-payment-user"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            >
              <option value="">Select a member</option>
              {overview.investors.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.name} · {row.email} · {formatAed(row.balanceAed)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Amount in AED</span>
            <input
              type="number"
              min={1}
              required
              value={payment.amount}
              onChange={(event) => setPayment({ ...payment, amount: event.target.value })}
              placeholder="25000"
              data-testid="admin-payment-amount"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            />
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Investment property</span>
            <select
              value={payment.residence}
              onChange={(event) => setPayment({ ...payment, residence: event.target.value })}
              data-testid="admin-payment-residence"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none focus:border-brass"
            >
              {RESIDENCES.map((residence) => (
                <option key={residence.slug} value={residence.name}>
                  {residence.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Reference or note</span>
            <input
              type="text"
              value={payment.note}
              onChange={(event) => setPayment({ ...payment, note: event.target.value })}
              placeholder="Bank transfer received"
              data-testid="admin-payment-note"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.9rem] outline-none placeholder:text-ink-soft/60 focus:border-brass"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              data-testid="admin-payment-submit"
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Credit wallet
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>
      </section>

<section id="prices" style={{ display: sectionShown('prices') ? undefined : 'none' }} className="border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Listing prices</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Administration only. Changes appear immediately on the homepage, the residences page and
            each residence detail page.
          </p>
        </div>
        <ul data-testid="admin-prices" className="divide-y divide-border">
          {RESIDENCES.map((residence) => {
            const stored = storedPrices?.find((row) => row.slug === residence.slug)
            const value = priceDrafts[residence.slug] ?? stored?.priceLabel ?? residence.price
            return (
              <li key={residence.slug} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm">{residence.name}</p>
                  <p className="mt-1 text-xs text-ink-soft">{residence.area}</p>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(event) =>
                      setPriceDrafts({ ...priceDrafts, [residence.slug]: event.target.value })
                    }
                    data-testid={`admin-price-${residence.slug}`}
                    className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-brass sm:w-56"
                  />
                  <button
                    type="button"
                    onClick={() => savePrice(residence.slug, residence.price)}
                    data-testid={`admin-price-save-${residence.slug}`}
                    className="eyebrow shrink-0 border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                  >
                    Save
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <section id="card-payments" style={{ display: sectionShown('card-payments') ? undefined : 'none' }} className="scroll-mt-24 border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Card payments</h2>
          <p className="mt-1 text-xs text-ink-soft">
            Members pay in AED, USD or INR. The AED value of one unit of each currency is set below
            and applied to every new checkout.
          </p>
        </div>

        <ul data-testid="admin-rates" className="divide-y divide-border">
          {(rates ?? []).map((rate) => (
            <li
              key={rate.code}
              className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm">{rate.label}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  AED per 1 {rate.code} · currently {rate.aedPerUnit}
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0.0001}
                  step="0.0001"
                  value={rateDrafts[rate.code] ?? String(rate.aedPerUnit)}
                  onChange={(event) =>
                    setRateDrafts({ ...rateDrafts, [rate.code]: event.target.value })
                  }
                  data-testid={`admin-rate-${rate.code}`}
                  className="w-full border border-input bg-background px-3 py-2.5 text-sm outline-none focus:border-brass sm:w-40"
                />
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await setRate({
                        code: rate.code,
                        aedPerUnit: Number(rateDrafts[rate.code] ?? rate.aedPerUnit),
                      })
                    } catch (err) {
                      console.error('Could not save the exchange rate', err)
                    }
                  }}
                  data-testid={`admin-rate-save-${rate.code}`}
                  className="eyebrow shrink-0 border border-border px-4 py-2.5 text-[0.5rem] transition-colors hover:border-brass"
                >
                  Save
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-6 py-5">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Confirmed card totals</p>
          {cardSummary === undefined ? (
            <p className="mt-3 text-sm text-ink-soft">Loading totals…</p>
          ) : cardSummary.length === 0 ? (
            <p data-testid="admin-summary-empty" className="mt-3 text-sm text-ink-soft">
              No confirmed card payments yet.
            </p>
          ) : (
            <div data-testid="admin-summary" data-state="ready" className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[34rem] text-left text-sm">
                <thead>
                  <tr className="eyebrow text-[0.45rem] text-ink-soft">
                    <th scope="col" className="pb-2 pr-4 font-normal">Currency</th>
                    <th scope="col" className="pb-2 pr-4 font-normal">Top-ups</th>
                    <th scope="col" className="pb-2 pr-4 font-normal">Deposits</th>
                    <th scope="col" className="pb-2 pr-4 font-normal">Total charged</th>
                    <th scope="col" className="pb-2 font-normal">In AED</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cardSummary.map((row) => (
                    <tr key={row.code} data-testid={`admin-summary-${row.code}`}>
                      <td className="py-3 pr-4">{row.code}</td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {row.topupCount} · {formatMoney(row.topupCharged, row.code)}
                      </td>
                      <td className="py-3 pr-4 text-ink-soft">
                        {row.depositCount} · {formatMoney(row.depositCharged, row.code)}
                      </td>
                      <td className="py-3 pr-4">{formatMoney(row.totalCharged, row.code)}</td>
                      <td className="py-3">{formatMoney(row.totalAed, 'AED')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t border-border px-6 py-5">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Recent card payments</p>
          {cardPayments === undefined ? (
            <p className="mt-3 text-sm text-ink-soft">Loading payments…</p>
          ) : cardPayments.length === 0 ? (
            <p data-testid="admin-payments-empty" className="mt-3 text-sm text-ink-soft">
              No card payments yet.
            </p>
          ) : (
            <ul data-testid="admin-payments" className="mt-3 divide-y divide-border">
              {cardPayments.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <span>
                    {row.name}
                    <span className="ml-2 text-xs text-ink-soft">{row.email}</span>
                  </span>
                  <span className="text-xs text-ink-soft">
                    {row.kind === 'topup' ? 'Top-up' : 'Deposit'} · {row.currency}{' '}
                    {row.amountCharged.toLocaleString()} · AED {row.amountAed.toLocaleString()} ·{' '}
                    {row.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

<section id="administrators" style={{ display: sectionShown('administrators') ? undefined : 'none' }} className="border border-border bg-card">
        <div className="border-b border-border px-6 py-5">
          <h2 className="display text-xl">Administrators</h2>
          <p className="mt-2 text-sm text-ink-soft">
            Removing the last administrator leaves the area open for the next member to claim.
          </p>
        </div>
        <ul data-testid="admin-list" className="divide-y divide-border">
          {overview.admins.map((row) => (
            <li key={row.userId} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
              <span>
                {row.email}
                <span className="ml-3 eyebrow text-[0.45rem] text-ink-soft">{row.role}</span>
              </span>
              <button
                type="button"
                onClick={() => removeAdmin(row.userId, row.email)}
                data-testid={`admin-remove-${row.userId}`}
                className="eyebrow border border-border px-4 py-2 text-[0.5rem] transition-colors hover:border-brass"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      </section>

<section id="admin-login" style={{ display: sectionShown('admin-login') ? undefined : 'none' }} className="border border-border bg-card p-6">
        <h2 className="display text-xl">Admin login details</h2>
        <p className="mt-2 text-sm text-ink-soft">
          Change the email and password used to sign in to this administrator account. Leave a field
          empty to keep it as it is.
        </p>
        <p className="mt-2 text-xs text-ink-soft">
          Current email: <span data-testid="admin-current-email">{currentLogin?.email ?? '…'}</span>
        </p>
        <form
          onSubmit={async (event) => {
            event.preventDefault()
            setError(null)
            setNotice(null)
            if (loginPassword && loginPassword !== loginConfirm) {
              return setError('The two passwords do not match')
            }
            try {
              const result = await updateLogin({
                email: loginEmail.trim() || undefined,
                password: loginPassword || undefined,
              })
              setNotice(
                `Saved. Sign in with ${result.email}${result.passwordChanged ? ' and your new password' : ''} from now on.`,
              )
              setLoginEmail('')
              setLoginPassword('')
              setLoginConfirm('')
            } catch (err) {
              setError(errorMessage(err, 'Could not update the login details'))
            }
          }}
          className="mt-4 grid gap-3 sm:max-w-md"
          data-testid="admin-login-form"
        >
          <label className="eyebrow text-[0.45rem] text-ink-soft" htmlFor="admin-login-email">
            New email
          </label>
          <input
            id="admin-login-email"
            type="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            placeholder={currentLogin?.email ?? 'name@example.com'}
            autoComplete="email"
            data-testid="admin-login-email"
            className="w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass"
          />
          <label className="eyebrow text-[0.45rem] text-ink-soft" htmlFor="admin-login-password">
            New password
          </label>
          <input
            id="admin-login-password"
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            data-testid="admin-login-password"
            className="w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass"
          />
          <label className="eyebrow text-[0.45rem] text-ink-soft" htmlFor="admin-login-confirm">
            Repeat password
          </label>
          <input
            id="admin-login-confirm"
            type="password"
            value={loginConfirm}
            onChange={(event) => setLoginConfirm(event.target.value)}
            autoComplete="new-password"
            data-testid="admin-login-confirm"
            className="w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass"
          />
          <button
            type="submit"
            data-testid="admin-login-save"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
          >
            Save login details
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>

<section id="add-admin" style={{ display: sectionShown('add-admin') ? undefined : 'none' }} className="border border-border bg-card p-6">
        <h2 className="display text-xl">Add an administrator</h2>
        <p className="mt-2 text-sm text-ink-soft">
          The member must already be registered with that email address.
        </p>
        <form onSubmit={addAdmin} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            required
            value={newAdmin}
            onChange={(event) => setNewAdmin(event.target.value)}
            placeholder="name@example.com"
            data-testid="admin-grant-email"
            className="w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass sm:max-w-sm"
          />
          <button
            type="submit"
            data-testid="admin-grant-submit"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85"
          >
            Grant access
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </section>

      <section
        id="journal"
        data-testid="admin-section-journal"
        style={{ display: sectionShown('journal') ? undefined : 'none' }}
        className="scroll-mt-24"
      >
        <JournalEditor />
      </section>

      <section
        id="backup"
        data-testid="admin-section-backup"
        style={{ display: sectionShown('backup') ? undefined : 'none' }}
        className="scroll-mt-24 border border-border bg-card p-6"
      >
        <DataBackup />
      </section>
        </div>
      </div>
    </div>
  )
}
