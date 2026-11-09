import { WorkspaceSidebar } from '../components/workspace-sidebar'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import type { User } from '@supabase/supabase-js'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { requireSupabase } from '../lib/supabase-client'
import { errorMessage } from '../lib/errors'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

type Row = Record<string, any>
type Section = 'overview' | 'properties' | 'enquiries' | 'users' | 'promotions' | 'finance' | 'investments' | 'commissions' | 'verifications' | 'tasks' | 'payments' | 'content' | 'team' | 'support' | 'settings'
const SECTIONS: { id: Section; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'properties', label: 'Properties' },
  { id: 'enquiries', label: 'Enquiries' },
  { id: 'users', label: 'Customers' },
  { id: 'promotions', label: 'Promotions' },
  { id: 'finance', label: 'Wallet & finance' },
  { id: 'investments', label: 'Investments' },
  { id: 'commissions', label: 'Commissions' },
  { id: 'verifications', label: 'Identity checks' },
  { id: 'tasks', label: 'Tasks & levels' },
  { id: 'payments', label: 'Payment records' },
  { id: 'content', label: 'Content & journal' },
  { id: 'team', label: 'Administrators' },
  { id: 'support', label: 'Support' },
  { id: 'settings', label: 'Settings' },
]
const CURRENCIES = ['AED', 'OMR', 'SAR', 'KWD', 'BHD', 'QAR', 'INR']
const meta = siteMetadata['/admin']
const money = (value: unknown, currency = 'AED') => new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0))
const date = (value: unknown) => value ? new Date(String(value)).toLocaleString() : '—'
const text = (value: unknown) => String(value ?? '')
const normalizeAdminStatus = (value: unknown) => text(value).trim().toLowerCase().replace(/[\\s-]+/g, '_')
const inputClass = 'w-full border border-input bg-background px-3 py-3 text-sm outline-none focus:border-brass'
const buttonClass = 'eyebrow inline-flex items-center justify-center gap-2 bg-primary px-5 py-3 text-[0.56rem] text-primary-foreground disabled:opacity-50'
const softButton = 'eyebrow border border-border px-4 py-2.5 text-[0.52rem] transition-colors hover:border-brass disabled:opacity-50'

export const Route = createFileRoute('/admin')({
  head: () => {
    const canonical = canonicalUrl('/admin')
    return {
      meta: [{ title: meta.title }, { name: 'description', content: meta.description }, { name: 'robots', content: 'noindex' }],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AdminPage,
})

function AdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [adminRole, setAdminRole] = useState<'owner' | 'admin' | ''>('')
  const [ownerPinSet, setOwnerPinSet] = useState(false)
  const [ownerVerified, setOwnerVerified] = useState(false)
  const [ownerPin, setOwnerPin] = useState('')
  const [newOwnerPin, setNewOwnerPin] = useState('')
  const [confirmOwnerPin, setConfirmOwnerPin] = useState('')
  const [currentOwnerPin, setCurrentOwnerPin] = useState('')
  const [checking, setChecking] = useState(true)
  const [section, setSection] = useState<Section>('overview')
  const [rows, setRows] = useState<Record<string, Row[]>>({})
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [propertyDraft, setPropertyDraft] = useState({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' })
  const [editingPropertyId, setEditingPropertyId] = useState('')
  const [promotionDraft, setPromotionDraft] = useState({ title: '', description: '', image_url: '', property_slug: '', active: false })
  const [editingPromotionId, setEditingPromotionId] = useState('')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerStatus, setCustomerStatus] = useState('all')
  const [enquirySearch, setEnquirySearch] = useState('')
  const [enquiryStatus, setEnquiryStatus] = useState('all')
  const [enquiryFromDate, setEnquiryFromDate] = useState('')
  const [enquiryToDate, setEnquiryToDate] = useState('')
  const [selectedEnquiryId, setSelectedEnquiryId] = useState('')
  const [profileCustomerId, setProfileCustomerId] = useState('')
  const [profileAddress, setProfileAddress] = useState('')
  const [profileInterest, setProfileInterest] = useState('')
  const [profileLevel, setProfileLevel] = useState('0')
  const [notificationDraft, setNotificationDraft] = useState({ user_id: '', title: '', body: '' })
  const [profitDraft, setProfitDraft] = useState({ user_id: '', amount: '', currency: 'AED', period_start: '', period_end: '', description: 'Monthly profit credited to customer wallet' })
  const [commissionDraft, setCommissionDraft] = useState({ user_id: '', plan_id: '', base_amount: '', currency: 'AED', commission_type: 'referral', source_user_id: '', reference: '', description: '' })
  const [manualWalletDraft, setManualWalletDraft] = useState({ user_id: '', amount: '', currency: 'AED', description: 'Balance added by administrator' })
  const [walletSearch, setWalletSearch] = useState('')
  const [walletCurrencyFilter, setWalletCurrencyFilter] = useState('all')
  const [walletDirectionFilter, setWalletDirectionFilter] = useState('all')
  const [walletFromDate, setWalletFromDate] = useState('')
  const [walletToDate, setWalletToDate] = useState('')
  const [financeSearch, setFinanceSearch] = useState('')
  const [financeStatus, setFinanceStatus] = useState('all')
  const [investmentSearch, setInvestmentSearch] = useState('')
  const [investmentStatus, setInvestmentStatus] = useState('all')
  const [commissionSearch, setCommissionSearch] = useState('')
  const [commissionStatus, setCommissionStatus] = useState('all')
  const [selectedThread, setSelectedThread] = useState('')
  const [supportSearch, setSupportSearch] = useState('')
  const [supportStatus, setSupportStatus] = useState('all')
  const [supportMessageVersion, setSupportMessageVersion] = useState(0)
  const [reply, setReply] = useState('')
  const [postDraft, setPostDraft] = useState({ title: '', slug: '', category: 'News', excerpt: '', content: '', cover_image_url: '', author_name: 'Msheireb Properties' })
  const [paymentDetailsDraft, setPaymentDetailsDraft] = useState({ bank_name: '', account_name: '', account_number: '', iban: '', swift: '', note: '' })
  const [telegramUsername, setTelegramUsername] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [fxDrafts, setFxDrafts] = useState<Record<string, string>>({})
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({})
  const [planDrafts, setPlanDrafts] = useState<Record<string, { name: string; minimum_amount: string; profit_percent: string; commission_percent: string }>>({})
  const [newPlanDraft, setNewPlanDraft] = useState({ code: '', level: '1', name: '', minimum_amount: '0', profit_percent: '0', commission_percent: '0', active: false })
  const [taskDraft, setTaskDraft] = useState({ user_id: '', title: '', detail: '', target_level: '1' })

  const load = useCallback(async () => {
    setChecking(true)
    setError('')
    try {
      const client = requireSupabase()
      const { data: auth, error: authError } = await client.auth.getUser()
      if (authError) throw authError
      setUser(auth.user)
      if (!auth.user) { setAuthorized(false); return }
      const { data: membership, error: membershipError } = await client.from('admin_members').select('role').eq('user_id', auth.user.id).maybeSingle()
      if (membershipError || !membership) { setAuthorized(false); setAdminRole(''); return }
      setAdminRole(membership.role === 'owner' ? 'owner' : 'admin')
      if (membership.role === 'owner') {
        const { data: pinSet, error: pinStatusError } = await client.rpc('owner_pin_is_set')
        if (pinStatusError) throw pinStatusError
        setOwnerPinSet(Boolean(pinSet))
        setOwnerVerified(false)
      } else {
        setOwnerPinSet(false)
        setOwnerVerified(true)
      }
      setAuthorized(true)
      const queries: Record<string, PromiseLike<any>> = {
        properties: client.from('properties').select('*').order('created_at', { ascending: false }),
        enquiries: client.from('enquiries').select('*,properties(name)').order('created_at', { ascending: false }).limit(100),
        users: client.from('profiles').select('id,full_name,mobile,preferred_currency,preferred_language,created_at').order('created_at', { ascending: false }).limit(200),
        promotions: client.from('promotions').select('*').order('created_at', { ascending: false }),
        topups: client.from('topup_requests').select('*').order('created_at', { ascending: false }).limit(100),
        withdrawals: client.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(100),
        investments: client.from('investments').select('*').order('created_at', { ascending: false }).limit(100),
        profits: client.from('profit_payouts').select('*').order('created_at', { ascending: false }).limit(100),
        commissions: client.from('commission_records').select('*').order('created_at', { ascending: false }).limit(200),
        threads: client.from('support_threads').select('*').order('updated_at', { ascending: false }).limit(100),
        fx: client.from('fx_rates').select('*').order('code'),
        prices: client.from('property_prices').select('*').order('slug'),
        plans: client.from('membership_plans').select('*').order('level'),
        investmentRequests: client.from('investment_requests').select('*').order('created_at', { ascending: false }).limit(100),
        verifications: client.from('verifications').select('*').order('submitted_at', { ascending: false }).limit(100),
        tasks: client.from('member_tasks').select('*').order('created_at', { ascending: false }).limit(100),
        payments: client.from('payments').select('*').order('created_at', { ascending: false }).limit(100),
        reservationDeposits: client.from('reservation_deposits').select('*').order('created_at', { ascending: false }).limit(100),
        posts: client.from('posts').select('*').order('created_at', { ascending: false }).limit(100),
        admins: client.from('admin_members').select('*').order('created_at', { ascending: false }),
        accounts: client.from('account_states').select('*'),
        paymentDetails: client.from('payment_details').select('*').order('updated_at', { ascending: false }),
        supportSettings: client.from('support_settings').select('*').eq('id', 'default').limit(1),
        memberProfiles: client.from('member_profiles').select('*').order('created_at', { ascending: false }).limit(200),
        notifications: client.from('notifications').select('*').order('created_at', { ascending: false }).limit(100),
        financialAudit: client.from('financial_audit_log').select('*').order('created_at', { ascending: false }).limit(200),
        walletTransactions: client.from('wallet_transactions').select('*').order('created_at', { ascending: false }).limit(200),
      }
      const names = Object.keys(queries)
      const results = await Promise.all(names.map((name) => queries[name]))
      const next: Record<string, Row[]> = {}
      results.forEach((result, index) => {
        if (result.error) throw result.error
        next[names[index]] = (result.data ?? []) as Row[]
      })
      setRows(next)
      setFxDrafts(Object.fromEntries((next.fx ?? []).map((row) => [text(row.code), text(row.aed_per_unit)])))
      setPriceDrafts(Object.fromEntries((next.prices ?? []).map((row) => [text(row.id), text(row.price_label)])))
      setPlanDrafts(Object.fromEntries((next.plans ?? []).map((row) => [text(row.id), { name: text(row.name), minimum_amount: text(row.minimum_amount), profit_percent: text(row.profit_percent), commission_percent: text(row.commission_percent) }])))
      setTelegramUsername(text(next.supportSettings?.[0]?.telegram_username))
      const paymentDetails = next.paymentDetails?.[0]
      if (paymentDetails) setPaymentDetailsDraft({ bank_name: text(paymentDetails.bank_name), account_name: text(paymentDetails.account_name), account_number: text(paymentDetails.account_number), iban: text(paymentDetails.iban), swift: text(paymentDetails.swift), note: text(paymentDetails.note) })
    } catch (cause) {
      setError(errorMessage(cause, 'Could not load administration data.'))
    } finally {
      setChecking(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const client = requireSupabase()
    const { data: listener } = client.auth.onAuthStateChange(() => { void load() })
    return () => listener.subscription.unsubscribe()
  }, [load])

  const customerLabel = (userId: unknown) => {
    const profile = (rows.users ?? []).find((item) => item.id === userId)
    return text(profile?.full_name) || text(profile?.mobile) || text(userId) || 'Unknown customer'
  }

  const topupRequestsWithCustomer = useMemo(() => (rows.topups ?? []).map((item) => ({
    ...item, customer_name: customerLabel(item.user_id),
  })), [rows.topups, rows.users])

  const withdrawalRequestsWithCustomer = useMemo(() => (rows.withdrawals ?? []).map((item) => ({
    ...item, customer_name: customerLabel(item.user_id),
  })), [rows.withdrawals, rows.users])

  const financeRequestMatches = (item: Row) => {
    const query = financeSearch.trim().toLowerCase()
    const normalizeStatus = (value: unknown) => text(value).trim().toLowerCase().replace(/[\\s-]+/g, '_')
    const status = normalizeStatus(item.status)
    const selectedStatus = normalizeStatus(financeStatus)
    const matchesQuery = !query || [item.customer_name, item.user_id, item.id, item.amount, item.currency, item.payment_reference, item.payout_method, item.payout_details, item.admin_note, item.created_at]
      .some((value) => text(value).toLowerCase().includes(query))
    return matchesQuery && (selectedStatus === 'all' || status === selectedStatus)
  }
  const filteredTopupRequests = useMemo(() => topupRequestsWithCustomer.filter(financeRequestMatches), [topupRequestsWithCustomer, financeSearch, financeStatus])
  const filteredWithdrawalRequests = useMemo(() => withdrawalRequestsWithCustomer.filter(financeRequestMatches), [withdrawalRequestsWithCustomer, financeSearch, financeStatus])

  const investmentRequestsWithCustomer = useMemo(() => (rows.investmentRequests ?? []).map((item) => ({
    ...item, customer_name: customerLabel(item.user_id),
  })), [rows.investmentRequests, rows.users])

  const fundedInvestmentsWithCustomer = useMemo(() => (rows.investments ?? []).map((item) => ({
    ...item, customer_name: customerLabel(item.user_id),
  })), [rows.investments, rows.users])

  const investmentRecordMatches = (item: Row) => {
    const query = investmentSearch.trim().toLowerCase()
    const matchesQuery = !query || [item.customer_name, item.user_id, item.id, item.property_id, item.property_name, item.plan_code, item.reference, item.amount, item.currency, item.status, item.created_at]
      .some((value) => text(value).toLowerCase().includes(query))
    const normalizeStatus = (value: unknown) => text(value).trim().toLowerCase().replace(/[\\s-]+/g, '_')
    const matchesStatus = normalizeStatus(investmentStatus) === 'all' || normalizeStatus(item.status) === normalizeStatus(investmentStatus)
    return matchesQuery && matchesStatus
  }
  const filteredInvestmentRequests = useMemo(() => investmentRequestsWithCustomer.filter(investmentRecordMatches), [investmentRequestsWithCustomer, investmentSearch, investmentStatus])
  const filteredFundedInvestments = useMemo(() => fundedInvestmentsWithCustomer.filter(investmentRecordMatches), [fundedInvestmentsWithCustomer, investmentSearch, investmentStatus])

  const commissionsWithCustomers = useMemo(() => (rows.commissions ?? []).map((item) => ({
    ...item,
    customer_name: customerLabel(item.user_id),
    source_customer_name: item.source_user_id ? customerLabel(item.source_user_id) : '—',
  })), [rows.commissions, rows.users])

  const commissionRecordMatches = (item: Row) => {
    const query = commissionSearch.trim().toLowerCase()
    const matchesQuery = !query || [item.customer_name, item.user_id, item.source_customer_name, item.source_user_id, item.commission_type, item.reference, item.description, item.amount, item.currency, item.status, item.created_at]
      .some((value) => text(value).toLowerCase().includes(query))
    const normalizeStatus = (value: unknown) => text(value).trim().toLowerCase().replace(/[\\s-]+/g, '_')
    const matchesStatus = normalizeStatus(commissionStatus) === 'all' || normalizeStatus(item.status) === normalizeStatus(commissionStatus)
    return matchesQuery && matchesStatus
  }
  const filteredCommissions = useMemo(() => commissionsWithCustomers.filter(commissionRecordMatches), [commissionsWithCustomers, commissionSearch, commissionStatus])

  const investmentCustomerSummary = useMemo(() => {
    const grouped = new Map<string, Row>()
    for (const item of investmentRequestsWithCustomer) {
      const currency = text(item.currency) || 'AED'
      const key = `${text(item.user_id)}:${currency}`
      const status = normalizeAdminStatus(item.status)
      const entry = grouped.get(key) ?? {
        customer_name: item.customer_name, user_id: item.user_id, currency,
        request_count: 0, requested_amount: 0, pending_count: 0,
        approved_count: 0, funded_count: 0, rejected_count: 0,
      }
      entry.request_count += 1
      entry.requested_amount += Number(item.amount || 0)
      if (status === 'pending') entry.pending_count += 1
      else if (status === 'approved') entry.approved_count += 1
      else if (status === 'funded' || status === 'active') entry.funded_count += 1
      else if (status === 'rejected') entry.rejected_count += 1
      grouped.set(key, entry)
    }
    return Array.from(grouped.values()).sort((a, b) => text(a.customer_name).localeCompare(text(b.customer_name)))
  }, [investmentRequestsWithCustomer])

  const commissionCustomerSummary = useMemo(() => {
    const grouped = new Map<string, Row>()
    for (const item of commissionsWithCustomers) {
      const currency = text(item.currency) || 'AED'
      const key = `${text(item.user_id)}:${currency}`
      const status = normalizeAdminStatus(item.status)
      const entry = grouped.get(key) ?? {
        customer_name: item.customer_name, user_id: item.user_id, currency,
        commission_count: 0, total_commission: 0, pending_amount: 0,
        approved_amount: 0, credited_amount: 0, rejected_amount: 0,
      }
      const amount = Number(item.amount || 0)
      entry.commission_count += 1
      entry.total_commission += amount
      if (status === 'pending') entry.pending_amount += amount
      else if (status === 'approved') entry.approved_amount += amount
      else if (['credited', 'paid', 'completed'].includes(status)) entry.credited_amount += amount
      else if (status === 'rejected') entry.rejected_amount += amount
      grouped.set(key, entry)
    }
    return Array.from(grouped.values()).sort((a, b) => text(a.customer_name).localeCompare(text(b.customer_name)))
  }, [commissionsWithCustomers])

  const filteredWalletTransactions = useMemo(() => {
    const query = walletSearch.trim().toLowerCase()
    const customers = rows.users ?? []
    return (rows.walletTransactions ?? []).filter((item) => {
      const customer = customers.find((profile) => profile.id === item.user_id)
      const matchesSearch = !query || [item.user_id, customer?.full_name, customer?.mobile, item.description, item.transaction_type]
        .some((value) => text(value).toLowerCase().includes(query))
      const matchesCurrency = walletCurrencyFilter === 'all' || text(item.currency) === walletCurrencyFilter
      const matchesDirection = walletDirectionFilter === 'all' || text(item.direction).toLowerCase() === walletDirectionFilter
      const created = item.created_at ? new Date(item.created_at).getTime() : 0
      const afterFrom = !walletFromDate || created >= new Date(walletFromDate + 'T00:00:00').getTime()
      const beforeTo = !walletToDate || created <= new Date(walletToDate + 'T23:59:59.999').getTime()
      return matchesSearch && matchesCurrency && matchesDirection && afterFrom && beforeTo
    }).map((item) => {
      const customer = customers.find((profile) => profile.id === item.user_id)
      return { ...item, customer_name: text(customer?.full_name) || text(customer?.mobile) || 'Unknown customer' }
    })
  }, [rows.walletTransactions, rows.users, walletSearch, walletCurrencyFilter, walletDirectionFilter, walletFromDate, walletToDate])

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase()
    return (rows.users ?? []).filter((item) => {
      const accountStatus = text((rows.accounts ?? []).find((entry) => entry.user_id === item.id)?.status ?? 'active')
      const matchesQuery = !query || [item.full_name, item.mobile, item.email, item.id, item.preferred_currency, item.preferred_language].some((value) => text(value).toLowerCase().includes(query))
      const matchesStatus = customerStatus === 'all' || accountStatus === customerStatus
      return matchesQuery && matchesStatus
    })
  }, [rows.users, rows.accounts, customerSearch, customerStatus])

  const filteredEnquiries = useMemo(() => {
    const query = enquirySearch.trim().toLowerCase()
    return (rows.enquiries ?? []).filter((item) => {
      const relatedProperty = Array.isArray(item.properties) ? item.properties[0] : item.properties
      const propertyName = text(relatedProperty?.name)
      const matchesQuery = !query || [item.full_name, item.mobile, item.email, item.message, propertyName]
        .some((value) => text(value).toLowerCase().includes(query))
      const matchesStatus = enquiryStatus === 'all' || text(item.status || 'new') === enquiryStatus
      const created = item.created_at ? new Date(item.created_at).getTime() : 0
      const afterFrom = !enquiryFromDate || created >= new Date(enquiryFromDate + 'T00:00:00').getTime()
      const beforeTo = !enquiryToDate || created <= new Date(enquiryToDate + 'T23:59:59.999').getTime()
      return matchesQuery && matchesStatus && afterFrom && beforeTo
    }).map((item) => {
      const relatedProperty = Array.isArray(item.properties) ? item.properties[0] : item.properties
      return { ...item, property_name: relatedProperty?.name || 'General enquiry' }
    })
  }, [rows.enquiries, enquirySearch, enquiryStatus, enquiryFromDate, enquiryToDate])

  const selectedEnquiry = filteredEnquiries.find((item) => text(item.id) === selectedEnquiryId) ?? null

  const supportThreadsWithCustomer = useMemo(() => (rows.threads ?? []).map((thread) => ({
    ...thread,
    customer_name: customerLabel(thread.user_id),
  })), [rows.threads, rows.users])

  const filteredSupportThreads = useMemo(() => {
    const query = supportSearch.trim().toLowerCase()
    return supportThreadsWithCustomer.filter((thread) => {
      const matchesQuery = !query || [thread.customer_name, thread.user_id, thread.id, thread.subject, thread.status]
        .some((value) => text(value).toLowerCase().includes(query))
      const matchesStatus = supportStatus === 'all' || text(thread.status || 'open').toLowerCase() === supportStatus
      return matchesQuery && matchesStatus
    })
  }, [supportThreadsWithCustomer, supportSearch, supportStatus])

  const selectedSupportThread = supportThreadsWithCustomer.find((thread) => text(thread.id) === selectedThread) ?? null

  const customerActivity = useMemo(() => {
    if (!profileCustomerId) return []
    const sources: [string, Row[]][] = [
      ['Top-up', rows.topups ?? []], ['Withdrawal', rows.withdrawals ?? []],
      ['Profit payout', rows.profits ?? []], ['Funded investment', rows.investments ?? []],
      ['Investment request', rows.investmentRequests ?? []], ['Commission', rows.commissions ?? []],
      ['Wallet transaction', rows.walletTransactions ?? []],
      ['Payment', rows.payments ?? []], ['Reservation deposit', rows.reservationDeposits ?? []],
    ]
    return sources.flatMap(([type, items]) => items
      .filter((item) => item.user_id === profileCustomerId)
      .map((item) => ({
        id: type + '-' + text(item.id), type,
        amount: item.amount ?? item.amount_aed ?? item.total_amount ?? '—',
        currency: item.currency ?? '—',
        status: item.status ?? item.direction ?? '—',
        reference: item.reference ?? item.payment_reference ?? item.transaction_reference ?? item.id,
        details: item.description ?? item.admin_note ?? item.payout_method ?? item.payment_method ?? '—',
        created_at: item.created_at ?? item.requested_at ?? item.submitted_at ?? item.date ?? null,
      })))
      .sort((a, b) => new Date(String(b.created_at ?? 0)).getTime() - new Date(String(a.created_at ?? 0)).getTime())
  }, [profileCustomerId, rows])

  const selectedCustomerFinancialSummary = useMemo(() => {
    if (!profileCustomerId) return []
    const grouped = new Map<string, Row>()
    const getEntry = (currencyValue: unknown) => {
      const currency = text(currencyValue) || 'AED'
      if (!grouped.has(currency)) grouped.set(currency, {
        currency, investment_requests: 0, funded_investments: 0,
        pending_commissions: 0, approved_commissions: 0, credited_commissions: 0,
        wallet_credits: 0, wallet_debits: 0,
      })
      return grouped.get(currency)!
    }
    for (const item of rows.investmentRequests ?? []) if (item.user_id === profileCustomerId) getEntry(item.currency).investment_requests += Number(item.amount || 0)
    for (const item of rows.investments ?? []) if (item.user_id === profileCustomerId) getEntry(item.currency).funded_investments += Number(item.amount || 0)
    for (const item of rows.commissions ?? []) if (item.user_id === profileCustomerId) {
      const status = text(item.status).toLowerCase()
      const entry = getEntry(item.currency)
      if (status === 'pending') entry.pending_commissions += Number(item.amount || 0)
      else if (status === 'approved') entry.approved_commissions += Number(item.amount || 0)
      else if (['credited', 'paid', 'completed'].includes(status)) entry.credited_commissions += Number(item.amount || 0)
    }
    for (const item of rows.walletTransactions ?? []) if (item.user_id === profileCustomerId) {
      const entry = getEntry(item.currency)
      const amount = Number(item.amount || 0)
      const direction = text(item.direction).toLowerCase()
      if (['credit', 'in', 'incoming'].includes(direction)) entry.wallet_credits += amount
      else if (['debit', 'out', 'outgoing'].includes(direction)) entry.wallet_debits += amount
    }
    return Array.from(grouped.values()).sort((a, b) => text(a.currency).localeCompare(text(b.currency)))
  }, [profileCustomerId, rows])

  const stats = useMemo(() => ({
    properties: (rows.properties ?? []).filter((row) => row.status === 'published').length,
    enquiries: (rows.enquiries ?? []).filter((row) => !row.status || row.status === 'new').length,
    totalEnquiries: (rows.enquiries ?? []).length,
    contactedEnquiries: (rows.enquiries ?? []).filter((row) => row.status === 'contacted').length,
    closedEnquiries: (rows.enquiries ?? []).filter((row) => row.status === 'closed').length,
    customers: (rows.users ?? []).length,
    pending: (rows.topups ?? []).filter((row) => row.status === 'pending').length + (rows.withdrawals ?? []).filter((row) => row.status === 'pending').length,
    pendingInvestmentReviews: (rows.investmentRequests ?? []).filter((row) => normalizeAdminStatus(row.status) === 'pending').length,
    approvedInvestmentFunding: (rows.investmentRequests ?? []).filter((row) => normalizeAdminStatus(row.status) === 'approved').length,
    pendingCommissionReviews: (rows.commissions ?? []).filter((row) => text(row.status).toLowerCase() === 'pending').length,
    approvedCommissionCredits: (rows.commissions ?? []).filter((row) => text(row.status).toLowerCase() === 'approved').length,
    pendingIdentityReviews: (rows.verifications ?? []).filter((row) => normalizeAdminStatus(row.status) === 'pending').length,
  }), [rows])

  const financeSummary = useMemo(() => ({
    topups: (rows.topups ?? []).length,
    withdrawals: (rows.withdrawals ?? []).length,
    profitCredits: (rows.profits ?? []).length,
    pendingTopups: (rows.topups ?? []).filter((row) => row.status === 'pending').length,
    pendingWithdrawals: (rows.withdrawals ?? []).filter((row) => row.status === 'pending').length,
    approvedWithdrawals: (rows.withdrawals ?? []).filter((row) => row.status === 'approved').length,
  }), [rows])

  const financePendingByCurrency = useMemo(() => {
    const totals = new Map<string, { topups: number; withdrawals: number; approvedWithdrawals: number }>()
    for (const item of rows.topups ?? []) {
      if (text(item.status).toLowerCase() !== 'pending') continue
      const code = text(item.currency) || 'AED'
      const entry = totals.get(code) ?? { topups: 0, withdrawals: 0, approvedWithdrawals: 0 }
      entry.topups += Number(item.amount || 0)
      totals.set(code, entry)
    }
    for (const item of rows.withdrawals ?? []) {
      const status = text(item.status).toLowerCase()
      if (status !== 'pending' && status !== 'approved') continue
      const code = text(item.currency) || 'AED'
      const entry = totals.get(code) ?? { topups: 0, withdrawals: 0, approvedWithdrawals: 0 }
      if (status === 'pending') entry.withdrawals += Number(item.amount || 0)
      if (status === 'approved') entry.approvedWithdrawals += Number(item.amount || 0)
      totals.set(code, entry)
    }
    return [...totals.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [rows.topups, rows.withdrawals])

  const run = async (work: () => Promise<unknown>, success: string) => {
    setBusy(true); setError(''); setNotice('')
    try { await work(); setNotice(success); await load() }
    catch (cause) { setError(errorMessage(cause, 'The action could not be completed.')) }
    finally { setBusy(false) }
  }

  const saveProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const client = requireSupabase()
      const payload = { ...propertyDraft, slug: propertyDraft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') }
      const query = editingPropertyId ? client.from('properties').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingPropertyId) : client.from('properties').insert(payload)
      const { error: saveError } = await query
      if (saveError) throw saveError
      setEditingPropertyId('')
      setPropertyDraft({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' })
    }, editingPropertyId ? 'Property changes saved.' : 'Property saved.')
  }

  const saveCustomerProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!profileCustomerId) { setError('Select a customer first.'); return }
    const level = Number(profileLevel)
    if (!Number.isInteger(level) || level < 0) { setError('Membership level must be a whole number of zero or higher.'); return }
    await run(async () => {
      const { error: saveError } = await requireSupabase().from('member_profiles').upsert({
        user_id: profileCustomerId,
        address: profileAddress.trim() || null,
        interest: profileInterest.trim() || null,
        membership_level: level,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      if (saveError) throw saveError
    }, 'Customer profile saved.')
  }

  const sendCustomerNotification = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const userId = notificationDraft.user_id.trim()
    const title = notificationDraft.title.trim()
    const body = notificationDraft.body.trim()
    if (!userId || !title || !body) { setError('Customer ID, title and message are required.'); return }
    if (title.length > 160 || body.length > 4000) { setError('Title must be 160 characters or less and message 4,000 characters or less.'); return }
    await run(async () => {
      const { error: insertError } = await requireSupabase().from('notifications').insert({ user_id: userId, title, body })
      if (insertError) throw insertError
      setNotificationDraft({ user_id: '', title: '', body: '' })
    }, 'Customer notification sent.')
  }

  const savePromotion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const query = editingPromotionId
        ? requireSupabase().from('promotions').update({ ...promotionDraft, updated_at: new Date().toISOString() }).eq('id', editingPromotionId)
        : requireSupabase().from('promotions').insert(promotionDraft)
      const { error: saveError } = await query
      if (saveError) throw saveError
      setEditingPromotionId('')
      setPromotionDraft({ title: '', description: '', image_url: '', property_slug: '', active: false })
    }, editingPromotionId ? 'Promotion changes saved.' : 'Promotion created.')
  }

  const reviewTopup = (id: string, approve: boolean) => run(async () => {
    const { error: rpcError } = await requireSupabase().rpc('admin_review_topup', { p_request_id: id, p_approve: approve, p_admin_note: approve ? 'Approved by administrator' : 'Rejected by administrator' })
    if (rpcError) throw rpcError
  }, approve ? 'Top-up approved and ledger credited.' : 'Top-up rejected.')

  const reviewWithdrawal = (id: string, action: 'approve' | 'reject' | 'pay') => {
    const confirmation = action === 'pay'
      ? 'Confirm that the external bank/payment transfer has already been completed. Only then mark this withdrawal as paid.'
      : action === 'approve'
        ? 'Approve this withdrawal request? This does not transfer money; the external payout must still be completed.'
        : 'Reject this withdrawal request?'
    if (!window.confirm(confirmation)) return
    return run(async () => {
    const note = action === 'pay' ? 'External payout confirmed by administrator' : action === 'approve' ? 'Approved by administrator; external payout still required' : 'Rejected by administrator'
    const { error: rpcError } = await requireSupabase().rpc('admin_review_withdrawal', { p_request_id: id, p_action: action, p_admin_note: note })
    if (rpcError) throw rpcError
    }, action === 'pay' ? 'Withdrawal marked paid in the internal ledger.' : action === 'approve' ? 'Withdrawal approved; no bank transfer was made.' : 'Withdrawal rejected.')
  }

  const addWalletBalance = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const { error: rpcError } = await requireSupabase().rpc('admin_add_wallet_balance', {
        p_user_id: manualWalletDraft.user_id,
        p_amount: Number(manualWalletDraft.amount),
        p_currency: manualWalletDraft.currency,
        p_description: manualWalletDraft.description,
      })
      if (rpcError) throw rpcError
      setManualWalletDraft({ user_id: '', amount: '', currency: 'AED', description: 'Balance added by administrator' })
    }, 'Wallet balance added to the customer account.')
  }

  const creditProfit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const { error: rpcError } = await requireSupabase().rpc('admin_credit_profit_payout', {
        p_user_id: profitDraft.user_id, p_amount: Number(profitDraft.amount), p_currency: profitDraft.currency,
        p_period_start: profitDraft.period_start, p_period_end: profitDraft.period_end, p_description: profitDraft.description,
      })
      if (rpcError) throw rpcError
      setProfitDraft({ user_id: '', amount: '', currency: 'AED', period_start: '', period_end: '', description: 'Monthly profit credited to customer wallet' })
    }, 'Profit credited to the customer internal wallet.')
  }

  const createCommission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const baseAmount = Number(commissionDraft.base_amount)
    if (!commissionDraft.user_id || !commissionDraft.plan_id) { setError('Select a customer and an active commission plan.'); return }
    if (!Number.isFinite(baseAmount) || baseAmount <= 0 || baseAmount > 100000000) { setError('Enter a valid commission base amount.'); return }
    await run(async () => {
      const { error: rpcError } = await requireSupabase().rpc('admin_create_commission', {
        p_user_id: commissionDraft.user_id,
        p_plan_id: commissionDraft.plan_id,
        p_base_amount: baseAmount,
        p_currency: commissionDraft.currency,
        p_commission_type: commissionDraft.commission_type,
        p_source_user_id: commissionDraft.source_user_id || null,
        p_reference: commissionDraft.reference || null,
        p_description: commissionDraft.description || null,
      })
      if (rpcError) throw rpcError
      setCommissionDraft({ user_id: '', plan_id: '', base_amount: '', currency: 'AED', commission_type: 'referral', source_user_id: '', reference: '', description: '' })
    }, 'Commission calculated from the selected plan rate and added to the pending review queue.')
  }

  const reviewCommission = (id: string, action: 'credit' | 'reject') => run(async () => {
    const { error: rpcError } = await requireSupabase().rpc('admin_review_commission', {
      p_commission_id: id,
      p_action: action,
      p_admin_note: action === 'credit' ? 'Approved and credited by administrator' : 'Rejected by administrator',
    })
    if (rpcError) throw rpcError
  }, action === 'credit' ? 'Commission approved and credited to the internal wallet.' : 'Commission rejected.')

  const reviewInvestmentRequest = (id: string, action: 'approve' | 'reject') => run(async () => {
    const { error: rpcError } = await requireSupabase().rpc('admin_review_investment_request', {
      p_request_id: id,
      p_action: action,
      p_admin_note: action === 'approve' ? 'Approved by administrator' : 'Rejected by administrator',
    })
    if (rpcError) throw rpcError
  }, action === 'approve' ? 'Investment approved. Plan percentages were recalculated from the current admin settings.' : 'Investment request rejected.')

  const fundInvestmentRequest = (id: string) => run(async () => {
    const { error: rpcError } = await requireSupabase().rpc('admin_fund_investment_request', { p_request_id: id })
    if (rpcError) throw rpcError
  }, 'Investment funded from the customer posted wallet balance and recorded in the ledger.')

  const setAccountState = (customerId: string, status: 'active' | 'frozen' | 'blocked') => run(async () => {
    const { error: stateError } = await requireSupabase().from('account_states').upsert({ user_id: customerId, status, reason: status === 'active' ? null : 'Updated by administrator', updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (stateError) throw stateError
  }, `Customer account set to ${status}.`)

  const openIdentityDocument = async (objectPath: string) => {
    try {
      const { data, error: signedUrlError } = await requireSupabase().storage.from('identity-documents').createSignedUrl(objectPath, 60)
      if (signedUrlError) throw signedUrlError
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the private identity document.')
    }
  }

  const updateStatus = (table: string, id: string, patch: Row, success: string) => run(async () => {
    const { error: updateError } = await requireSupabase().from(table).update(patch).eq('id', id)
    if (updateError) throw updateError
  }, success)

  const sendReply = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selectedThread || !reply.trim() || !user) return
    if (text(selectedSupportThread?.status || 'open').toLowerCase() === 'closed') {
      setError('This conversation is closed. Reopen it before sending another reply.')
      return
    }
    await run(async () => {
      const client = requireSupabase()
      const { error: sendError } = await client.from('support_messages').insert({ thread_id: selectedThread, sender_id: user.id, message: reply.trim() })
      if (sendError) throw sendError
      const { error: threadError } = await client.from('support_threads').update({ updated_at: new Date().toISOString() }).eq('id', selectedThread)
      if (threadError) throw threadError
      setReply('')
      setSupportMessageVersion((version) => version + 1)
    }, 'Reply sent.')
  }

  const changeSupportStatus = async (status: 'open' | 'closed') => {
    if (!selectedThread) return
    const action = status === 'closed' ? 'close' : 'reopen'
    if (!window.confirm(`Are you sure you want to ${action} this support conversation?`)) return
    await run(async () => {
      const { error: updateError } = await requireSupabase()
        .from('support_threads')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', selectedThread)
      if (updateError) throw updateError
    }, status === 'closed' ? 'Support conversation closed.' : 'Support conversation reopened.')
  }

  const savePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const payload = { ...postDraft, slug: postDraft.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), updated_by: user?.id }
      const { error: saveError } = await requireSupabase().from('posts').insert(payload)
      if (saveError) throw saveError
      setPostDraft({ title: '', slug: '', category: 'News', excerpt: '', content: '', cover_image_url: '', author_name: 'Msheireb Properties' })
    }, 'Journal post created as a draft.')
  }

  const assignMemberTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const userId = taskDraft.user_id.trim()
    const title = taskDraft.title.trim()
    const level = Number(taskDraft.target_level)
    if (!userId || !title) { setError('Select a customer and enter a task title.'); return }
    if (!Number.isInteger(level) || level < 0) { setError('Target level must be a whole number of zero or higher.'); return }
    await run(async () => {
      const { error: insertError } = await requireSupabase().from('member_tasks').insert({
        user_id: userId,
        title,
        detail: taskDraft.detail.trim() || null,
        target_level: level,
        status: 'assigned',
      })
      if (insertError) throw insertError
      setTaskDraft({ user_id: '', title: '', detail: '', target_level: '1' })
    }, 'Task assigned to the customer.')
  }

  const createMembershipPlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const level = Number(newPlanDraft.level)
    const minimum = Number(newPlanDraft.minimum_amount)
    const profit = Number(newPlanDraft.profit_percent)
    const commission = Number(newPlanDraft.commission_percent)
    const code = newPlanDraft.code.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-|-$/g, '')
    if (!code || !newPlanDraft.name.trim()) { setError('Enter a plan name and unique plan code.'); return }
    if (!Number.isInteger(level) || level < 0 || ![minimum, profit, commission].every(Number.isFinite) || minimum < 0 || profit < 0 || profit > 100 || commission < 0 || commission > 100) {
      setError('Enter a valid level, minimum amount and percentages from 0 to 100.')
      return
    }
    await run(async () => {
      const { error: saveError } = await requireSupabase().from('membership_plans').insert({
        code, level, name: newPlanDraft.name.trim(), minimum_amount: minimum,
        profit_percent: profit, commission_percent: commission, active: newPlanDraft.active,
        updated_at: new Date().toISOString(), updated_by: user?.id,
      })
      if (saveError) throw saveError
      setNewPlanDraft({ code: '', level: '1', name: '', minimum_amount: '0', profit_percent: '0', commission_percent: '0', active: false })
    }, 'Investment plan created.')
  }

  const saveTelegramSupport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = telegramUsername.trim().replace(/^@/, '')
    if (username && !/^[A-Za-z0-9_]{5,32}$/.test(username)) { setError('Enter a valid Telegram username (5–32 letters, numbers or underscores), without the @ symbol.'); return }
    await run(async () => {
      const { error: saveError } = await requireSupabase().from('support_settings').upsert({ id: 'default', telegram_username: username || null, updated_by: user?.id, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      if (saveError) throw saveError
    }, 'Telegram support contact saved.')
  }

  const savePaymentDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await run(async () => {
      const payload = { bank_name: paymentDetailsDraft.bank_name, account_name: paymentDetailsDraft.account_name, account_number: paymentDetailsDraft.account_number, iban: paymentDetailsDraft.iban, swift: paymentDetailsDraft.swift, note: paymentDetailsDraft.note, updated_by: user?.id, updated_at: new Date().toISOString() }
      const existing = rows.paymentDetails?.[0]
      const query = existing?.id ? requireSupabase().from('payment_details').update(payload).eq('id', existing.id) : requireSupabase().from('payment_details').insert(payload)
      const { error: saveError } = await query
      if (saveError) throw saveError
    }, 'Payment instructions saved.')
  }

  const submitOwnerPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true); setError(''); setNotice('')
    try {
      const client = requireSupabase()
      if (!ownerPinSet) {
        if (!/^\d{4}$/.test(newOwnerPin)) throw new Error('Choose exactly four digits.')
        if (newOwnerPin !== confirmOwnerPin) throw new Error('The two codes do not match.')
        const { error: saveError } = await client.rpc('owner_set_pin', { p_new_pin: newOwnerPin, p_current_pin: null })
        if (saveError) throw saveError
        const { data: verified, error: verifyError } = await client.rpc('owner_verify_pin', { p_pin: newOwnerPin })
        if (verifyError) throw verifyError
        if (!verified) throw new Error('Owner code was saved, but verification did not complete. Please sign in again.')
        setOwnerPinSet(true); setOwnerVerified(true)
        const { data: adminDirectory, error: directoryError } = await client.rpc('admin_manage_access', { p_action: 'list', p_email: null, p_user_id: null })
        if (directoryError) throw directoryError
        setRows((current) => ({ ...current, admins: (adminDirectory ?? []) as Row[] }))
        setNewOwnerPin(''); setConfirmOwnerPin('')
        setNotice('Owner security code created. You are now verified for this login.')
      } else {
        const { data: verified, error: verifyError } = await client.rpc('owner_verify_pin', { p_pin: ownerPin })
        if (verifyError) throw verifyError
        if (!verified) throw new Error('Incorrect code. Please try again.')
        setOwnerVerified(true); setOwnerPin('')
        const { data: adminDirectory, error: directoryError } = await client.rpc('admin_manage_access', { p_action: 'list', p_email: null, p_user_id: null })
        if (directoryError) throw directoryError
        setRows((current) => ({ ...current, admins: (adminDirectory ?? []) as Row[] }))
        setNotice('Owner access verified.')
      }
    } catch (cause) { setError(errorMessage(cause, 'Owner verification failed.')) }
    finally { setBusy(false) }
  }

  const changeOwnerPin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{4}$/.test(newOwnerPin)) { setError('Choose exactly four digits.'); return }
    if (newOwnerPin !== confirmOwnerPin) { setError('The two codes do not match.'); return }
    await run(async () => {
      const { error: saveError } = await requireSupabase().rpc('owner_set_pin', { p_new_pin: newOwnerPin, p_current_pin: currentOwnerPin })
      if (saveError) throw saveError
      setNewOwnerPin(''); setConfirmOwnerPin(''); setCurrentOwnerPin('')
    }, 'Owner security code changed.')
  }

  const signOut = async () => {
    await requireSupabase().auth.signOut()
    setUser(null); setAuthorized(false); setOwnerVerified(false); setAdminRole('')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <WorkspaceSidebar mode="admin" active={section} onSelect={(id) => setSection(id as Section)} />
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36 lg:ml-64">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
          <header className="mb-8 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
            <div><p className="eyebrow text-brass">Private workspace</p><h1 className="display mt-3 text-3xl sm:text-4xl">Administration</h1><p className="mt-2 text-sm text-ink-soft">Msheireb Properties · Secure Supabase workspace</p></div>
            <div className="flex gap-3"><Link to="/dashboard" className={softButton}>Customer view <ArrowRight /></Link>{user ? <button type="button" onClick={signOut} className={softButton}>Sign out</button> : null}</div>
          </header>

          {checking ? <div className="border border-border bg-card p-10 text-center text-sm text-ink-soft">Checking administrator access…</div> : null}
          {!checking && !authorized ? <section className="max-w-2xl border border-border bg-card p-8 sm:p-12"><p className="eyebrow text-brass">Restricted access</p><h2 className="display mt-4 text-2xl">{user ? 'This account is not an administrator.' : 'Sign in to continue.'}</h2><p className="mt-3 text-sm leading-7 text-ink-soft">{user ? 'Ask the site owner to add this registered account to the admin_members table in Supabase. Admin access is never self-assigned.' : 'Use your administrator account to sign in first.'}</p><Link to="/login" className={buttonClass + ' mt-6'}>Go to login <ArrowRight /></Link></section> : null}
          {error ? <p role="alert" className="mb-5 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}
          {notice ? <p role="status" className="mb-5 border border-brass/40 bg-brass/5 px-4 py-3 text-sm">{notice}</p> : null}

          {authorized && adminRole === 'owner' && !ownerVerified ? <section className="mx-auto max-w-xl border border-border bg-card p-8 sm:p-10"><p className="eyebrow text-brass">Owner security</p><h2 className="display mt-4 text-2xl">{ownerPinSet ? 'Enter your owner code' : 'Create your owner code'}</h2><p className="mt-3 text-sm leading-7 text-ink-soft">{ownerPinSet ? 'Enter your private four-digit code to unlock the owner workspace. Administrators do not need this code.' : 'Create a private four-digit code. You will enter it whenever you sign in to the owner workspace. Do not share it with administrators.'}</p><form onSubmit={submitOwnerPin} className="mt-6 grid gap-4">{ownerPinSet ? <input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{4}" maxLength={4} type="password" className={inputClass} placeholder="Four-digit owner code" value={ownerPin} onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /> : <><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" className={inputClass} placeholder="Create four-digit code" value={newOwnerPin} onChange={(e) => setNewOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /><input required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} type="password" className={inputClass} placeholder="Confirm four-digit code" value={confirmOwnerPin} onChange={(e) => setConfirmOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /></>}{error ? <p role="alert" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p> : null}<button disabled={busy} className={buttonClass}>{busy ? 'Please wait…' : ownerPinSet ? 'Verify owner code' : 'Create owner code'} <ArrowRight /></button></form></section> : null}
          {authorized && (adminRole !== 'owner' || ownerVerified) ? <>
            <nav aria-label="Administration sections" className="mb-8 flex gap-2 overflow-x-auto border-b border-border pb-3">
              {SECTIONS.filter((item) => item.id !== 'team' || adminRole === 'owner').map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} className={section === item.id ? 'eyebrow shrink-0 border-b-2 border-brass px-4 py-3 text-[0.55rem] text-brass' : 'eyebrow shrink-0 px-4 py-3 text-[0.55rem] text-ink-soft hover:text-foreground'}>{item.label}</button>)}
            </nav>

            {section === 'overview' ? <section>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['Published properties', stats.properties],
                  ['New enquiries', stats.enquiries],
                  ['All enquiries', stats.totalEnquiries],
                  ['Contacted enquiries', stats.contactedEnquiries],
                  ['Closed enquiries', stats.closedEnquiries],
                  ['Customer accounts', stats.customers],
                  ['Pending financial requests', stats.pending],
                  ['Investment applications to review', stats.pendingInvestmentReviews],
                  ['Approved investments awaiting funding', stats.approvedInvestmentFunding],
                  ['Commissions awaiting review', stats.pendingCommissionReviews],
                  ['Approved commissions awaiting credit', stats.approvedCommissionCredits],
                  ['Identity checks awaiting review', stats.pendingIdentityReviews],
                ].map(([label, value]) => <div key={label} className="border border-border bg-card p-6"><p className="eyebrow text-[0.5rem] text-ink-soft">{label}</p><p className="display mt-3 text-3xl">{value}</p></div>)}
              </div>
              <section className="mt-6 grid gap-4 border border-brass/40 bg-card p-5"><div><h2 className="display text-xl">Financial review queue</h2><p className="mt-1 text-xs leading-5 text-ink-soft">These counts are based on the records currently loaded. Review each item before approving, funding or crediting any customer account.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><button type="button" onClick={() => setSection('investments')} className="border border-border p-4 text-left hover:border-brass"><span className="eyebrow text-[0.5rem] text-ink-soft">Investment applications</span><strong className="display mt-2 block text-2xl">{stats.pendingInvestmentReviews}</strong><span className="mt-1 block text-xs text-ink-soft">Pending review · Open investments</span></button><button type="button" onClick={() => setSection('investments')} className="border border-border p-4 text-left hover:border-brass"><span className="eyebrow text-[0.5rem] text-ink-soft">Investment funding</span><strong className="display mt-2 block text-2xl">{stats.approvedInvestmentFunding}</strong><span className="mt-1 block text-xs text-ink-soft">Approved · Awaiting wallet funding</span></button><button type="button" onClick={() => setSection('commissions')} className="border border-border p-4 text-left hover:border-brass"><span className="eyebrow text-[0.5rem] text-ink-soft">Commission review</span><strong className="display mt-2 block text-2xl">{stats.pendingCommissionReviews}</strong><span className="mt-1 block text-xs text-ink-soft">Pending · Open commissions</span></button><button type="button" onClick={() => setSection('commissions')} className="border border-border p-4 text-left hover:border-brass"><span className="eyebrow text-[0.5rem] text-ink-soft">Commission credits</span><strong className="display mt-2 block text-2xl">{stats.approvedCommissionCredits}</strong><span className="mt-1 block text-xs text-ink-soft">Approved · Awaiting credit</span></button><button type="button" onClick={() => setSection('verifications')} className="border border-border p-4 text-left hover:border-brass"><span className="eyebrow text-[0.5rem] text-ink-soft">Identity checks</span><strong className="display mt-2 block text-2xl">{stats.pendingIdentityReviews}</strong><span className="mt-1 block text-xs text-ink-soft">Pending · Open identity checks</span></button></div></section>
              <div className="mt-6 border border-border bg-card p-6"><h2 className="display text-xl">Quick actions</h2><div className="mt-4 flex flex-wrap gap-3">{SECTIONS.filter((item) => item.id !== 'overview').map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={softButton}>{item.label} <ArrowRight /></button>)}</div></div>
              <div className="mt-6"><DataTable title="Latest customer enquiries" rows={(rows.enquiries ?? []).slice(0, 5).map((item) => { const relatedProperty = Array.isArray(item.properties) ? item.properties[0] : item.properties; return { ...item, property_name: relatedProperty?.name || 'General enquiry' } })} columns={['full_name','mobile','property_name','status','created_at']} render={(item) => <button className={softButton} onClick={() => setSection('enquiries')}>Open enquiries <ArrowRight /></button>} /></div>
            </section> : null}

            {section === 'properties' ? <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_1.2fr]">
              <form onSubmit={saveProperty} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">{editingPropertyId ? 'Edit property' : 'Add property'}</h2><div className="mt-5 grid gap-3">
                <input className={inputClass} required placeholder="Property name" value={propertyDraft.name} onChange={(e) => setPropertyDraft({ ...propertyDraft, name: e.target.value, slug: propertyDraft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} />
                <input className={inputClass} required placeholder="URL slug" value={propertyDraft.slug} onChange={(e) => setPropertyDraft({ ...propertyDraft, slug: e.target.value })} />
                <input className={inputClass} placeholder="Location" value={propertyDraft.location} onChange={(e) => setPropertyDraft({ ...propertyDraft, location: e.target.value })} />
                <input className={inputClass} placeholder="Price label" value={propertyDraft.price_label} onChange={(e) => setPropertyDraft({ ...propertyDraft, price_label: e.target.value })} />
                <input className={inputClass} placeholder="Cover image URL" value={propertyDraft.cover_image_url} onChange={(e) => setPropertyDraft({ ...propertyDraft, cover_image_url: e.target.value })} />
                <textarea className={inputClass} rows={4} placeholder="Description" value={propertyDraft.description} onChange={(e) => setPropertyDraft({ ...propertyDraft, description: e.target.value })} />
                <select className={inputClass} value={propertyDraft.status} onChange={(e) => setPropertyDraft({ ...propertyDraft, status: e.target.value })}><option value="draft">Draft</option><option value="published">Published</option></select>
                <div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>{editingPropertyId ? 'Save changes' : 'Save property'} <ArrowRight /></button>{editingPropertyId ? <button type="button" disabled={busy} className={softButton} onClick={() => { setEditingPropertyId(''); setPropertyDraft({ name: '', slug: '', location: 'Dubai, UAE', description: '', price_label: 'Price on request', cover_image_url: '', status: 'draft' }) }}>Cancel edit</button> : null}</div>
              </div></form>
              <div className="border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">Property catalogue</h2></div><div className="divide-y divide-border">{(rows.properties ?? []).map((item) => <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><b className="text-sm">{text(item.name)}</b><p className="mt-1 text-xs text-ink-soft">{text(item.location)} · {text(item.price_label)}</p><p className="mt-1 text-[0.65rem] text-ink-soft">{text(item.slug)}</p></div><div className="flex flex-wrap gap-2"><span className="eyebrow self-center text-[0.48rem] text-brass">{text(item.status)}</span><button disabled={busy} className={softButton} onClick={() => { setEditingPropertyId(text(item.id)); setPropertyDraft({ name: text(item.name), slug: text(item.slug), location: text(item.location), description: text(item.description), price_label: text(item.price_label), cover_image_url: text(item.cover_image_url), status: text(item.status) }) }}>Edit</button>{item.status !== 'published' ? <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'published', updated_at: new Date().toISOString() }, 'Property published.')} className={softButton}>Publish</button> : <button disabled={busy} onClick={() => updateStatus('properties', text(item.id), { status: 'draft', updated_at: new Date().toISOString() }, 'Property moved to draft.')} className={softButton}>Unpublish</button>}</div></div>)}{!(rows.properties ?? []).length ? <p className="p-6 text-sm text-ink-soft">No properties yet.</p> : null}</div></div>
            </section> : null}

            {section === 'enquiries' ? <section className="grid gap-4"><div className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4"><input aria-label="Search enquiries" className={inputClass} value={enquirySearch} onChange={(event) => setEnquirySearch(event.target.value)} placeholder="Name, phone, email, property or message" /><select aria-label="Filter enquiry status" className={inputClass} value={enquiryStatus} onChange={(event) => setEnquiryStatus(event.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select><input aria-label="Enquiries from date" type="date" className={inputClass} value={enquiryFromDate} onChange={(event) => setEnquiryFromDate(event.target.value)} /><input aria-label="Enquiries to date" type="date" min={enquiryFromDate || undefined} className={inputClass} value={enquiryToDate} onChange={(event) => setEnquiryToDate(event.target.value)} /><div className="flex flex-wrap items-center justify-between gap-2 sm:col-span-2 xl:col-span-4"><p className="text-xs text-ink-soft">Showing {filteredEnquiries.length} of {(rows.enquiries ?? []).length} enquiries · New: {(rows.enquiries ?? []).filter((item) => !item.status || item.status === 'new').length} · Contacted: {(rows.enquiries ?? []).filter((item) => item.status === 'contacted').length} · Closed: {(rows.enquiries ?? []).filter((item) => item.status === 'closed').length}</p><button type="button" className={softButton} onClick={() => { setEnquirySearch(''); setEnquiryStatus('all'); setEnquiryFromDate(''); setEnquiryToDate(''); setSelectedEnquiryId('') }}>Clear filters</button></div></div>{selectedEnquiry ? <section className="grid gap-4 border border-brass/40 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="eyebrow text-[0.5rem] text-brass">Selected enquiry · {text(selectedEnquiry.status || 'new')}</p><h2 className="display mt-1 text-xl">{text(selectedEnquiry.full_name) || 'Customer enquiry'}</h2><p className="mt-1 text-xs text-ink-soft">{text(selectedEnquiry.property_name)} · Received {date(selectedEnquiry.created_at)}</p></div><button type="button" className={softButton} onClick={() => setSelectedEnquiryId('')}>Close details</button></div><div className="grid gap-3 sm:grid-cols-2"><div className="border border-border p-3"><p className="eyebrow text-[0.48rem] text-ink-soft">Phone</p><p className="mt-1 break-all text-sm">{text(selectedEnquiry.mobile) || 'Not provided'}</p></div><div className="border border-border p-3"><p className="eyebrow text-[0.48rem] text-ink-soft">Email</p><p className="mt-1 break-all text-sm">{text(selectedEnquiry.email) || 'Not provided'}</p></div></div><div><p className="eyebrow text-[0.48rem] text-ink-soft">Customer message</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{text(selectedEnquiry.message) || 'No message provided.'}</p></div><div className="flex flex-wrap gap-2">{text(selectedEnquiry.mobile) ? <a className={softButton} href={'tel:' + text(selectedEnquiry.mobile).replace(/[^+\\d]/g, '')}>Call customer</a> : null}{text(selectedEnquiry.email) ? <a className={softButton} href={'mailto:' + text(selectedEnquiry.email) + '?subject=' + encodeURIComponent('Your enquiry to Msheireb Properties')}>Email customer</a> : null}{selectedEnquiry.status !== 'contacted' ? <button type="button" disabled={busy} className={softButton} onClick={() => updateStatus('enquiries', text(selectedEnquiry.id), { status: 'contacted' }, 'Enquiry marked contacted.')}>Mark contacted</button> : null}{selectedEnquiry.status !== 'closed' ? <button type="button" disabled={busy} className={softButton} onClick={() => updateStatus('enquiries', text(selectedEnquiry.id), { status: 'closed' }, 'Enquiry closed.')}>Close enquiry</button> : null}</div><p className="text-[0.65rem] text-ink-soft">Follow-up actions open your phone or email app. Enquiry status is saved; private follow-up notes are not stored.</p></section> : null}<DataTable title="Customer enquiries" rows={filteredEnquiries} columns={['full_name','mobile','email','property_name','message','status','created_at']} render={(item) => { const phone = text(item.mobile).replace(/[^+\\d]/g, ''); const email = text(item.email); const subject = encodeURIComponent('Your enquiry to Msheireb Properties'); const body = encodeURIComponent('Hello ' + (text(item.full_name) || 'there') + ',\\n\\nThank you for your enquiry about ' + (text(item.property_name) || 'our properties') + '. Our team would be happy to assist you.\\n\\nMsheireb Properties'); return <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-ink-soft">{text(item.status || 'new')}</span><button type="button" className={softButton} onClick={() => setSelectedEnquiryId(text(item.id))}>View details</button>{phone ? <a className={softButton} href={'tel:' + phone}>Call customer</a> : null}{email ? <a className={softButton} href={'mailto:' + email + '?subject=' + subject + '&body=' + body}>Email follow-up</a> : null}<button className={softButton} disabled={busy || item.status === 'contacted'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'contacted' }, 'Enquiry marked contacted.')}>Mark contacted</button><button className={softButton} disabled={busy || item.status === 'closed'} onClick={() => updateStatus('enquiries', text(item.id), { status: 'closed' }, 'Enquiry closed.')}>Close</button></div> }} /></section> : null}
            {section === 'users' ? <section className="grid gap-4"><form onSubmit={saveCustomerProfile} className="grid gap-3 border border-border bg-card p-5"><h3 className="display text-lg">Edit customer profile</h3><select required className={inputClass} value={profileCustomerId} onChange={(event) => { const id = event.target.value; setProfileCustomerId(id); const p = (rows.memberProfiles ?? []).find((item) => item.user_id === id); setProfileAddress(text(p?.address)); setProfileInterest(text(p?.interest)); setProfileLevel(text(p?.membership_level ?? 0)) }}><option value="">Select customer</option>{(rows.users ?? []).map((item) => <option key={item.id} value={item.id}>{text(item.full_name) || 'Customer'} · {text(item.mobile) || text(item.id)}</option>)}</select><div className="grid gap-3 sm:grid-cols-3"><input className={inputClass} placeholder="Address" value={profileAddress} onChange={(event) => setProfileAddress(event.target.value)} /><input className={inputClass} placeholder="Property interest" value={profileInterest} onChange={(event) => setProfileInterest(event.target.value)} /><input type="number" min="0" step="1" className={inputClass} placeholder="Membership level" value={profileLevel} onChange={(event) => setProfileLevel(event.target.value)} /></div><button disabled={busy || !profileCustomerId} className={buttonClass}>Save customer profile <ArrowRight /></button></form>{profileCustomerId ? <><DataTable title="Selected customer financial summary by currency" rows={selectedCustomerFinancialSummary} columns={['currency','investment_requests','funded_investments','pending_commissions','approved_commissions','credited_commissions','wallet_credits','wallet_debits']} /><DataTable title="Selected customer activity — investments, commissions and wallet" rows={customerActivity} columns={['type','reference','details','amount','currency','status','created_at']} /></> : <p className="border border-dashed border-border p-4 text-sm text-ink-soft">Select a customer to review their investment requests, funded investments, commissions and wallet transactions together.</p>}<div className="grid gap-3 sm:grid-cols-3">{(['active','frozen','blocked'] as const).map((status) => <button key={status} type="button" onClick={() => setCustomerStatus(status)} className={customerStatus === status ? 'border border-brass bg-brass/10 p-4 text-left' : 'border border-border bg-card p-4 text-left hover:border-brass'}><p className="eyebrow text-[0.5rem] text-ink-soft">{status} accounts</p><p className="display mt-2 text-2xl">{(rows.users ?? []).filter((customer) => text((rows.accounts ?? []).find((entry) => entry.user_id === customer.id)?.status ?? 'active') === status).length}</p></button>)}</div><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="display text-xl">Customer accounts</h2><p className="mt-1 text-xs text-ink-soft">Search name, mobile, email, account ID, preferred currency or language. Showing {filteredCustomers.length} of {(rows.users ?? []).length} customers.</p></div><div className="flex flex-col gap-2 sm:flex-row"><input className={`${inputClass} sm:max-w-sm`} value={customerSearch} onChange={(event) => setCustomerSearch(event.target.value)} placeholder="Search customer details" /><select className={inputClass} value={customerStatus} onChange={(event) => setCustomerStatus(event.target.value)}><option value="all">All account statuses</option><option value="active">Active</option><option value="frozen">Frozen</option><option value="blocked">Blocked</option></select><button type="button" className={softButton} onClick={() => { setCustomerSearch(''); setCustomerStatus('all') }}>Clear filters</button></div></div><DataTable title="Registered customers" rows={filteredCustomers} columns={['id','full_name','mobile','preferred_currency','preferred_language','created_at']} render={(item) => { const state = (rows.accounts ?? []).find((entry) => entry.user_id === item.id)?.status ?? 'active'; return <div className="flex flex-wrap items-center gap-2"><span>{state}</span><button type="button" className={softButton} onClick={() => { void navigator.clipboard.writeText(text(item.id)).then(() => setNotice('Customer account ID copied.')).catch(() => setError('Could not copy account ID. Please select the ID in the table and copy it manually.')) }}>Copy ID</button>{state !== 'active' ? <button disabled={busy} className={softButton} onClick={() => setAccountState(text(item.id), 'active')}>Activate</button> : <button disabled={busy} className={softButton} onClick={() => setAccountState(text(item.id), 'frozen')}>Freeze</button>}<button disabled={busy || state === 'blocked'} className={softButton} onClick={() => setAccountState(text(item.id), 'blocked')}>Block</button></div> }} /></section> : null}
            {section === 'promotions' ? <section className="grid gap-6 xl:grid-cols-[minmax(18rem,0.8fr)_1.2fr]">
              <form onSubmit={savePromotion} className="h-fit border border-border bg-card p-6"><h2 className="display text-xl">{editingPromotionId ? 'Edit promotion' : 'Create promotion'}</h2><div className="mt-5 grid gap-3"><input required className={inputClass} placeholder="Promotion title" value={promotionDraft.title} onChange={(e) => setPromotionDraft({ ...promotionDraft, title: e.target.value })} /><textarea className={inputClass} rows={4} placeholder="Description" value={promotionDraft.description} onChange={(e) => setPromotionDraft({ ...promotionDraft, description: e.target.value })} /><input className={inputClass} placeholder="Image URL" value={promotionDraft.image_url} onChange={(e) => setPromotionDraft({ ...promotionDraft, image_url: e.target.value })} /><select className={inputClass} value={promotionDraft.property_slug} onChange={(e) => setPromotionDraft({ ...promotionDraft, property_slug: e.target.value })}><option value="">All properties</option>{(rows.properties ?? []).map((property) => <option key={property.id} value={text(property.slug)}>{text(property.name)}</option>)}</select><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={promotionDraft.active} onChange={(e) => setPromotionDraft({ ...promotionDraft, active: e.target.checked })} /> Active immediately</label><div className="flex flex-wrap gap-2"><button disabled={busy} className={buttonClass}>{editingPromotionId ? 'Save changes' : 'Create promotion'} <ArrowRight /></button>{editingPromotionId ? <button type="button" disabled={busy} className={softButton} onClick={() => { setEditingPromotionId(''); setPromotionDraft({ title: '', description: '', image_url: '', active: false }) }}>Cancel edit</button> : null}</div></div></form>
              <DataTable title="Promotions" rows={rows.promotions ?? []} columns={['title','property_slug','description','active','starts_at','ends_at']} render={(item) => <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => { setEditingPromotionId(text(item.id)); setPromotionDraft({ title: text(item.title), description: text(item.description), image_url: text(item.image_url), property_slug: text(item.property_slug), active: Boolean(item.active) }) }}>Edit</button><button disabled={busy} className={softButton} onClick={() => updateStatus('promotions', text(item.id), { active: !item.active, updated_at: new Date().toISOString() }, item.active ? 'Promotion paused.' : 'Promotion activated.')}>{item.active ? 'Pause' : 'Activate'}</button></div>} />
            </section> : null}

            {section === 'finance' ? <div className="grid gap-6">
              <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[
                ['Top-up requests', financeSummary.topups], ['Withdrawal requests', financeSummary.withdrawals], ['Profit credits', financeSummary.profitCredits],
                ['Pending top-ups', financeSummary.pendingTopups], ['Pending withdrawals', financeSummary.pendingWithdrawals], ['Approved withdrawals awaiting transfer', financeSummary.approvedWithdrawals],
              ].map(([label, value]) => <div key={String(label)} className="border border-border bg-card p-4"><p className="text-xs text-ink-soft">{label}</p><p className="display mt-2 text-2xl">{value}</p></div>)}</section>
              <section className="border border-border bg-card p-5">
                <h2 className="display text-lg">Outstanding request amounts by currency</h2>
                <p className="mt-1 text-xs leading-5 text-ink-soft">Pending deposits are requests only and are not wallet credits. Approved withdrawals still require an external transfer before they can be marked paid.</p>
                {financePendingByCurrency.length === 0 ? <p className="mt-4 text-sm text-ink-soft">No pending deposit or withdrawal amounts.</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{financePendingByCurrency.map(([code, totals]) => <div key={code} className="border border-border/70 p-3"><p className="eyebrow text-[0.55rem] text-ink-soft">{code}</p><p className="mt-3 text-xs text-ink-soft">Pending deposits</p><p className="display text-lg">{money(totals.topups, code)}</p><p className="mt-2 text-xs text-ink-soft">Pending withdrawals</p><p className="display text-lg">{money(totals.withdrawals, code)}</p><p className="mt-2 text-xs text-ink-soft">Approved, awaiting transfer</p><p className="display text-lg">{money(totals.approvedWithdrawals, code)}</p></div>)}</div>}
              </section>
              <section className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_14rem]"><div><label className="eyebrow text-[0.55rem] text-ink-soft" htmlFor="finance-request-search">Find a deposit or withdrawal</label><input id="finance-request-search" className={inputClass} value={financeSearch} onChange={(event) => setFinanceSearch(event.target.value)} placeholder="Customer, account ID, amount or reference" /></div><div><label className="eyebrow text-[0.55rem] text-ink-soft" htmlFor="finance-request-status">Request status</label><select id="finance-request-status" className={inputClass} value={financeStatus} onChange={(event) => setFinanceStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="submitted">Submitted</option><option value="under_review">Under review</option><option value="approved">Approved</option><option value="processing">Processing</option><option value="in_progress">In progress</option><option value="paid">Paid</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div><div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2"><p className="text-xs text-ink-soft">Showing {filteredTopupRequests.length} of {topupRequestsWithCustomer.length} deposit requests and {filteredWithdrawalRequests.length} of {withdrawalRequestsWithCustomer.length} withdrawal requests. The same search and status filter apply to both lists.</p><button type="button" className={softButton} onClick={() => { setFinanceSearch(''); setFinanceStatus('all') }} disabled={!financeSearch && financeStatus === 'all'}>Clear finance filters</button></div><p className="text-xs text-ink-soft sm:col-span-2">Approving a withdrawal does not send money; mark it paid only after the external transfer is completed.</p></section>
              <DataTable title="Top-up requests" rows={filteredTopupRequests} columns={['customer_name','user_id','amount','currency','payment_method','payment_reference','status','admin_note','created_at']} render={(item) => normalizeAdminStatus(item.status) === 'pending' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), true)}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewTopup(text(item.id), false)}>Reject</button></div> : null} />
              <DataTable title="Withdrawal requests" rows={filteredWithdrawalRequests} columns={['customer_name','user_id','amount','currency','payout_method','payout_details','status','admin_note','created_at']} render={(item) => normalizeAdminStatus(item.status) === 'pending' ? <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'approve')}>Approve</button><button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'reject')}>Reject</button></div> : normalizeAdminStatus(item.status) === 'approved' ? <button disabled={busy} className={softButton} onClick={() => reviewWithdrawal(text(item.id), 'pay')}>Mark paid after transfer</button> : null} />
              <form onSubmit={addWalletBalance} className="border border-brass/40 bg-card p-6">
                <h2 className="display text-xl">Add amount to customer wallet</h2>
                <p className="mt-2 text-xs leading-6 text-ink-soft">Administrator-only manual credit. The amount is posted to the customer's internal wallet ledger and recorded in the financial audit history. This does not transfer real money.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <select required className={inputClass} value={manualWalletDraft.user_id} onChange={(e) => setManualWalletDraft({ ...manualWalletDraft, user_id: e.target.value })}>
                    <option value="">Select customer</option>
                    {(rows.users ?? []).map((customer) => <option key={text(customer.id)} value={text(customer.id)}>{text(customer.full_name) || text(customer.mobile) || text(customer.id)}</option>)}
                  </select>
                  <input required type="number" min="0.01" max="100000000" step="0.01" className={inputClass} placeholder="Amount" value={manualWalletDraft.amount} onChange={(e) => setManualWalletDraft({ ...manualWalletDraft, amount: e.target.value })} />
                  <select className={inputClass} value={manualWalletDraft.currency} onChange={(e) => setManualWalletDraft({ ...manualWalletDraft, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select>
                  <input maxLength={240} className={inputClass} placeholder="Reason / description" value={manualWalletDraft.description} onChange={(e) => setManualWalletDraft({ ...manualWalletDraft, description: e.target.value })} />
                </div>
                <button disabled={busy || !manualWalletDraft.user_id || !manualWalletDraft.amount} className={buttonClass + ' mt-4'}>Add wallet balance <ArrowRight /></button>
              </form>
              <form onSubmit={creditProfit} className="border border-border bg-card p-6"><h2 className="display text-xl">Credit profit to customer wallet</h2><p className="mt-2 text-xs leading-6 text-ink-soft">This posts an internal wallet credit and audit record. It does not send a bank transfer.</p><div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><input required className={inputClass} placeholder="Customer user UUID" value={profitDraft.user_id} onChange={(e) => setProfitDraft({ ...profitDraft, user_id: e.target.value })} /><input required type="number" min="0.01" step="0.01" className={inputClass} placeholder="Amount" value={profitDraft.amount} onChange={(e) => setProfitDraft({ ...profitDraft, amount: e.target.value })} /><select className={inputClass} value={profitDraft.currency} onChange={(e) => setProfitDraft({ ...profitDraft, currency: e.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select><input required type="date" className={inputClass} value={profitDraft.period_start} onChange={(e) => setProfitDraft({ ...profitDraft, period_start: e.target.value })} /><input required type="date" className={inputClass} value={profitDraft.period_end} onChange={(e) => setProfitDraft({ ...profitDraft, period_end: e.target.value })} /><input className={inputClass} value={profitDraft.description} onChange={(e) => setProfitDraft({ ...profitDraft, description: e.target.value })} /></div><button disabled={busy} className={buttonClass + ' mt-4'}>Credit internal wallet <ArrowRight /></button></form>
              <section className="border border-border bg-card p-5">
                <h2 className="display text-lg">Filter wallet transactions</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <input aria-label="Search wallet transactions" className={inputClass} placeholder="Customer name, ID or description" value={walletSearch} onChange={(event) => setWalletSearch(event.target.value)} />
                  <select aria-label="Filter by currency" className={inputClass} value={walletCurrencyFilter} onChange={(event) => setWalletCurrencyFilter(event.target.value)}><option value="all">All currencies</option>{CURRENCIES.map((code) => <option key={code} value={code}>{code}</option>)}</select>
                  <select aria-label="Filter by transaction direction" className={inputClass} value={walletDirectionFilter} onChange={(event) => setWalletDirectionFilter(event.target.value)}><option value="all">All transaction types</option><option value="credit">Credits</option><option value="debit">Debits</option></select>
                  <input aria-label="From date" type="date" className={inputClass} value={walletFromDate} onChange={(event) => setWalletFromDate(event.target.value)} />
                  <input aria-label="To date" type="date" className={inputClass} value={walletToDate} onChange={(event) => setWalletToDate(event.target.value)} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="border border-border p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Filtered credits</p><p className="display mt-2 text-xl">{filteredWalletTransactions.filter((item) => text(item.direction).toLowerCase() === 'credit').length} <span className="text-sm text-ink-soft">transactions</span></p><p className="mt-1 text-sm">{filteredWalletTransactions.filter((item) => text(item.direction).toLowerCase() === 'credit').reduce((total, item) => total + (Number(item.amount) || 0), 0).toLocaleString('en', { maximumFractionDigits: 2 })} <span className="text-xs text-ink-soft">{walletCurrencyFilter === 'all' ? 'mixed currencies' : walletCurrencyFilter}</span></p></div>
                  <div className="border border-border p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Filtered debits</p><p className="display mt-2 text-xl">{filteredWalletTransactions.filter((item) => text(item.direction).toLowerCase() === 'debit').length} <span className="text-sm text-ink-soft">transactions</span></p><p className="mt-1 text-sm">{filteredWalletTransactions.filter((item) => text(item.direction).toLowerCase() === 'debit').reduce((total, item) => total + (Number(item.amount) || 0), 0).toLocaleString('en', { maximumFractionDigits: 2 })} <span className="text-xs text-ink-soft">{walletCurrencyFilter === 'all' ? 'mixed currencies' : walletCurrencyFilter}</span></p></div>
                  <div className="border border-border p-3"><p className="eyebrow text-[0.5rem] text-ink-soft">Filtered transactions</p><p className="display mt-2 text-xl">{filteredWalletTransactions.length}</p><p className="mt-1 text-xs text-ink-soft">Matching records</p></div>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-soft">{filteredWalletTransactions.length} matching transactions</p><button type="button" className={softButton} onClick={() => { setWalletSearch(''); setWalletCurrencyFilter('all'); setWalletDirectionFilter('all'); setWalletFromDate(''); setWalletToDate('') }}>Clear filters</button></div>
              </section>
              <DataTable title="Customer wallet transaction history" rows={filteredWalletTransactions} columns={['customer_name','user_id','transaction_type','direction','amount','currency','status','description','created_at']} />
              <DataTable title="Recent profit credits" rows={rows.profits ?? []} columns={['user_id','amount','currency','period_start','period_end','status','created_at']} />
              <DataTable title="Financial audit history" rows={rows.financialAudit ?? []} columns={['created_at','actor_id','action','entity_type','entity_id','details']} />
              <DataTable title="Investment requests" rows={fundedInvestmentsWithCustomer} columns={['customer_name','user_id','property_id','amount','currency','status','created_at']} />
            </div> : null}

            {section === 'investments' ? <div className="grid gap-6"><p className="border border-brass/40 bg-brass/5 p-4 text-xs leading-6">Review pending applications first. Approval does not move money: use Fund from wallet only after checking the customer balance; funding debits their posted internal wallet. Any related commission remains pending until separately approved and credited. Profit estimates are not guaranteed returns.</p><DataTable title="Investment totals by customer and currency" rows={investmentCustomerSummary} columns={['customer_name','user_id','currency','request_count','requested_amount','pending_count','approved_count','funded_count','rejected_count']} /><section className="grid gap-3 border border-border bg-card p-5"><h2 className="display text-lg">Find and filter investment records</h2><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Search investment records" className={inputClass} placeholder="Customer, user ID, property, plan or reference" value={investmentSearch} onChange={(event) => setInvestmentSearch(event.target.value)} /><select aria-label="Filter investment status" className={inputClass} value={investmentStatus} onChange={(event) => setInvestmentStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="funded">Funded</option><option value="active">Active</option><option value="completed">Completed</option><option value="rejected">Rejected</option></select></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-soft">{filteredInvestmentRequests.length} requests · {filteredFundedInvestments.length} funded records match</p><button type="button" className={softButton} onClick={() => { setInvestmentSearch(''); setInvestmentStatus('all') }}>Clear filters</button></div></section><DataTable title="Customer investment requests" rows={filteredInvestmentRequests} columns={['customer_name','user_id','property_name','plan_code','amount','currency','profit_percent','expected_profit','commission_percent','expected_commission','status','created_at']} render={(item) => normalizeAdminStatus(item.status) === 'pending' ? <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => { if (window.confirm('Approve this investment application? It will still need to be funded from the customer wallet separately.')) void reviewInvestmentRequest(text(item.id), 'approve') }}>Approve</button><button disabled={busy} className={softButton} onClick={() => { if (window.confirm('Reject this investment application?')) void reviewInvestmentRequest(text(item.id), 'reject') }}>Reject</button></div> : normalizeAdminStatus(item.status) === 'approved' ? <button disabled={busy} className={softButton} onClick={() => { if (window.confirm('Fund this investment now? The amount will be debited from the customer posted wallet balance.')) void fundInvestmentRequest(text(item.id)) }}>Fund from wallet</button> : null} /><DataTable title="Funded investment ledger" rows={filteredFundedInvestments} columns={['customer_name','user_id','property_id','amount','currency','status','reference','created_at']} /></div> : null}

            {section === 'commissions' ? <div className="grid gap-6"><DataTable title="Commission totals by customer and currency" rows={commissionCustomerSummary} columns={['customer_name','user_id','currency','commission_count','total_commission','pending_amount','approved_amount','credited_amount','rejected_amount']} /><section className="grid gap-3 border border-border bg-card p-5"><h2 className="display text-lg">Find and filter commission records</h2><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Search commission records" className={inputClass} placeholder="Customer, source customer, user ID, type or reference" value={commissionSearch} onChange={(event) => setCommissionSearch(event.target.value)} /><select aria-label="Filter commission status" className={inputClass} value={commissionStatus} onChange={(event) => setCommissionStatus(event.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="credited">Credited</option><option value="approved">Approved</option><option value="rejected">Rejected</option></select></div><div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-ink-soft">{filteredCommissions.length} commission records match · Only use Approve and credit after checking the customer, source and amount; this action posts an internal wallet credit.</p><button type="button" className={softButton} onClick={() => { setCommissionSearch(''); setCommissionStatus('all') }}>Clear filters</button></div></section><form onSubmit={createCommission} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Create commission record</h2><p className="text-xs leading-6 text-ink-soft">The commission percentage is read from the active plan you select. The amount is calculated by the database and remains pending until an administrator approves or rejects it.</p><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><select required className={inputClass} value={commissionDraft.user_id} onChange={(event) => setCommissionDraft({ ...commissionDraft, user_id: event.target.value })}><option value="">Commission recipient</option>{(rows.users ?? []).map((item) => <option key={item.id} value={item.id}>{text(item.full_name) || text(item.mobile) || text(item.id)}</option>)}</select><select required className={inputClass} value={commissionDraft.plan_id} onChange={(event) => setCommissionDraft({ ...commissionDraft, plan_id: event.target.value })}><option value="">Active commission plan</option>{(rows.plans ?? []).filter((plan) => plan.active).map((plan) => <option key={plan.id} value={plan.id}>{text(plan.name)} · {text(plan.commission_percent)}%</option>)}</select><input required type="number" min="0.01" max="100000000" step="0.01" className={inputClass} placeholder="Commission base amount" value={commissionDraft.base_amount} onChange={(event) => setCommissionDraft({ ...commissionDraft, base_amount: event.target.value })} /><select className={inputClass} value={commissionDraft.currency} onChange={(event) => setCommissionDraft({ ...commissionDraft, currency: event.target.value })}>{CURRENCIES.map((code) => <option key={code}>{code}</option>)}</select><select className={inputClass} value={commissionDraft.commission_type} onChange={(event) => setCommissionDraft({ ...commissionDraft, commission_type: event.target.value })}><option value="referral">Referral</option><option value="property">Property</option><option value="investment">Investment</option><option value="sales">Sales</option><option value="other">Other</option></select><select className={inputClass} value={commissionDraft.source_user_id} onChange={(event) => setCommissionDraft({ ...commissionDraft, source_user_id: event.target.value })}><option value="">Source customer (optional)</option>{(rows.users ?? []).filter((item) => item.id !== commissionDraft.user_id).map((item) => <option key={item.id} value={item.id}>{text(item.full_name) || text(item.mobile) || text(item.id)}</option>)}</select><input maxLength={160} className={inputClass} placeholder="Reference (optional)" value={commissionDraft.reference} onChange={(event) => setCommissionDraft({ ...commissionDraft, reference: event.target.value })} /><input maxLength={240} className={inputClass} placeholder="Description (optional)" value={commissionDraft.description} onChange={(event) => setCommissionDraft({ ...commissionDraft, description: event.target.value })} /></div><button disabled={busy || !commissionDraft.user_id || !commissionDraft.plan_id || !commissionDraft.base_amount} className={buttonClass}>Calculate and add pending commission <ArrowRight /></button></form><DataTable title="Commission records — pending items require review" rows={filteredCommissions} columns={['customer_name','user_id','source_customer_name','source_user_id','commission_type','reference','base_amount','commission_percent','amount','currency','status','description','created_at']} render={(item) => normalizeAdminStatus(item.status) === 'pending' ? <div className="flex flex-wrap gap-2"><button disabled={busy} className={softButton} onClick={() => { if (window.confirm('Approve this commission and credit the amount to the customer internal wallet?')) void reviewCommission(text(item.id), 'credit') }}>Approve and credit</button><button disabled={busy} className={softButton} onClick={() => { if (window.confirm('Reject this commission? It will not be credited to the customer wallet.')) void reviewCommission(text(item.id), 'reject') }}>Reject</button></div> : null} /><DataTable title="Commission rate configuration" rows={(rows.plans ?? []).map((item) => ({ ...item, commission_percent: text(item.commission_percent) + '%' }))} columns={['level','code','name','commission_percent','active']} /></div> : null}

            {section === 'verifications' ? <DataTable title="Customer identity verification" rows={rows.verifications ?? []} columns={['user_id','document_type','document_name','note','status','review_note','submitted_at','reviewed_at']} render={(item) => <div className="flex flex-wrap gap-2"><button type="button" className={softButton} onClick={() => void openIdentityDocument(text(item.document_url))}>View private document</button>{normalizeAdminStatus(item.status) === 'pending' ? <><button disabled={busy} className={softButton} onClick={() => updateStatus('verifications', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id }, 'Identity verification approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('verifications', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Please resubmit a valid document.' }, 'Identity verification rejected.')}>Reject</button></> : null}</div>} /> : null}


            {section === 'tasks' ? <div className="grid gap-6"><form onSubmit={assignMemberTask} className="grid gap-3 border border-brass/40 bg-card p-6"><div><h2 className="display text-xl">Assign a customer task</h2><p className="mt-1 text-xs text-ink-soft">Tasks are assigned to one customer and submitted by that customer for review.</p></div><div className="grid gap-3 sm:grid-cols-2"><select required className={inputClass} value={taskDraft.user_id} onChange={(event) => setTaskDraft({ ...taskDraft, user_id: event.target.value })}><option value="">Select customer</option>{(rows.users ?? []).map((customer) => <option key={text(customer.id)} value={text(customer.id)}>{text(customer.full_name) || text(customer.mobile) || text(customer.id)}</option>)}</select><select className={inputClass} value={taskDraft.target_level} onChange={(event) => setTaskDraft({ ...taskDraft, target_level: event.target.value })}><option value="0">Target level 0</option>{(rows.plans ?? []).map((plan) => <option key={text(plan.id)} value={text(plan.level)}>Level {text(plan.level)} — {text(plan.name)}</option>)}</select></div><input required maxLength={160} className={inputClass} placeholder="Task title" value={taskDraft.title} onChange={(event) => setTaskDraft({ ...taskDraft, title: event.target.value })} /><textarea maxLength={4000} rows={3} className={inputClass} placeholder="Task instructions and completion requirements" value={taskDraft.detail} onChange={(event) => setTaskDraft({ ...taskDraft, detail: event.target.value })} /><button disabled={busy || !(rows.users ?? []).length} className={buttonClass}>Assign task <ArrowRight /></button></form><DataTable title="Customer tasks" rows={rows.tasks ?? []} columns={['user_id','title','detail','target_level','status','created_at']} render={(item) => item.status === 'submitted' ? <div className="flex gap-2"><button disabled={busy} className={softButton} onClick={() => updateStatus('member_tasks', text(item.id), { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Approved' }, 'Task approved.')}>Approve</button><button disabled={busy} className={softButton} onClick={() => updateStatus('member_tasks', text(item.id), { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user?.id, review_note: 'Please review and resubmit' }, 'Task returned for correction.')}>Return</button></div> : null} /><DataTable title="Membership plans and levels" rows={rows.plans ?? []} columns={['level','code','name','minimum_amount','profit_percent','commission_percent','active']} render={(item) => <button disabled={busy} className={softButton} onClick={() => updateStatus('membership_plans', text(item.id), { active: !item.active, updated_at: new Date().toISOString(), updated_by: user?.id }, item.active ? 'Membership plan disabled.' : 'Membership plan enabled.')}>{item.active ? 'Disable' : 'Enable'}</button>} /><DataTable title="Extended member profiles" rows={rows.memberProfiles ?? []} columns={['user_id','address','referral_code','interest','membership_level','created_at']} /></div> : null}

            {section === 'payments' ? <div className="grid gap-6"><form onSubmit={savePaymentDetails} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Payment instructions</h2><p className="text-xs text-ink-soft">These instructions are for administrator reference only. Customers must submit a deposit request and contact customer support for guidance. Never enter private API keys here.</p><div className="grid gap-3 sm:grid-cols-2"><input className={inputClass} placeholder="Bank name" value={paymentDetailsDraft.bank_name} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, bank_name: e.target.value })} /><input className={inputClass} placeholder="Account name" value={paymentDetailsDraft.account_name} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, account_name: e.target.value })} /><input className={inputClass} placeholder="Account number" value={paymentDetailsDraft.account_number} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, account_number: e.target.value })} /><input className={inputClass} placeholder="IBAN" value={paymentDetailsDraft.iban} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, iban: e.target.value })} /><input className={inputClass} placeholder="SWIFT / BIC" value={paymentDetailsDraft.swift} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, swift: e.target.value })} /><input className={inputClass} placeholder="Payment note" value={paymentDetailsDraft.note} onChange={(e) => setPaymentDetailsDraft({ ...paymentDetailsDraft, note: e.target.value })} /></div><button disabled={busy} className={buttonClass}>Save payment instructions <ArrowRight /></button></form><DataTable title="Payment intents (test-mode records only)" rows={rows.payments ?? []} columns={['user_id','kind','amount','amount_charged','currency','provider','mode','status','created_at']} /><DataTable title="Reservation deposits" rows={rows.reservationDeposits ?? []} columns={['user_id','property_name','amount','amount_charged','currency','mode','created_at']} /><DataTable title="Payment instructions" rows={rows.paymentDetails ?? []} columns={['bank_name','account_name','account_number','iban','swift','note','updated_at']} /><p className="border border-brass/40 bg-brass/5 p-4 text-xs leading-6">Payment intent and reservation records do not confirm that money was received. A verified payment-provider webhook is required before any live payment or wallet credit.</p></div> : null}

            {section === 'content' ? <div className="grid gap-6"><form onSubmit={savePost} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Create journal post</h2><div className="grid gap-3 sm:grid-cols-2"><input required className={inputClass} placeholder="Post title" value={postDraft.title} onChange={(e) => setPostDraft({ ...postDraft, title: e.target.value, slug: postDraft.slug || e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-') })} /><input required className={inputClass} placeholder="URL slug" value={postDraft.slug} onChange={(e) => setPostDraft({ ...postDraft, slug: e.target.value })} /><input required className={inputClass} placeholder="Category" value={postDraft.category} onChange={(e) => setPostDraft({ ...postDraft, category: e.target.value })} /><input className={inputClass} placeholder="Cover image URL" value={postDraft.cover_image_url} onChange={(e) => setPostDraft({ ...postDraft, cover_image_url: e.target.value })} /><input required className={inputClass} placeholder="Author name" value={postDraft.author_name} onChange={(e) => setPostDraft({ ...postDraft, author_name: e.target.value })} /></div><textarea required rows={2} className={inputClass} placeholder="Short excerpt" value={postDraft.excerpt} onChange={(e) => setPostDraft({ ...postDraft, excerpt: e.target.value })} /><textarea required rows={8} className={inputClass} placeholder="Full article content" value={postDraft.content} onChange={(e) => setPostDraft({ ...postDraft, content: e.target.value })} /><button disabled={busy} className={buttonClass}>Save draft <ArrowRight /></button></form><DataTable title="Journal and website posts" rows={rows.posts ?? []} columns={['title','slug','category','excerpt','author_name','published','published_at','created_at']} render={(item) => <button disabled={busy} className={softButton} onClick={() => updateStatus('posts', text(item.id), { published: !item.published, published_at: item.published ? null : new Date().toISOString(), updated_at: new Date().toISOString(), updated_by: user?.id }, item.published ? 'Post unpublished.' : 'Post published.')}>{item.published ? 'Unpublish' : 'Publish'}</button>} /></div> : null}

            {section === 'team' && adminRole === 'owner' ? <div className="grid gap-6"><form onSubmit={changeOwnerPin} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Owner security code</h2><p className="text-xs text-ink-soft">Only the owner can change this private four-digit code. Administrators never need it.</p><input required type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={inputClass} placeholder="Current owner code" value={currentOwnerPin} onChange={(e) => setCurrentOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /><input required type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={inputClass} placeholder="New four-digit code" value={newOwnerPin} onChange={(e) => setNewOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /><input required type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={inputClass} placeholder="Confirm new code" value={confirmOwnerPin} onChange={(e) => setConfirmOwnerPin(e.target.value.replace(/\D/g, '').slice(0, 4))} /><button disabled={busy} className={buttonClass}>Change owner code <ArrowRight /></button></form><section className="grid gap-4 border border-border bg-card p-6"><div><h2 className="display text-xl">Add administrator</h2><p className="text-xs text-ink-soft">Enter the email address of an existing registered customer. Only the owner account can grant or remove administrator access.</p></div><form onSubmit={async (event) => { event.preventDefault(); const email = adminEmail.trim(); if (!email) return; await run(async () => { const { data, error: rpcError } = await requireSupabase().rpc('admin_manage_access', { p_action: 'add', p_email: email, p_user_id: null }); if (rpcError) throw rpcError; setRows((current) => ({ ...current, admins: (data ?? []) as Row[] })); setAdminEmail('') }, 'Administrator access granted.') }} className="grid gap-3 sm:grid-cols-[1fr_auto]"><input required type="email" className={inputClass} placeholder="Registered user email address" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} /><button disabled={busy} className={buttonClass}>Grant admin access <ArrowRight /></button></form></section><section className="overflow-hidden border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">Administrator accounts</h2><p className="mt-1 text-xs text-ink-soft">{(rows.admins ?? []).length} administrators</p></div><div className="divide-y divide-border">{[...(rows.admins ?? [])].sort((a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime()).map((admin, index) => <div key={admin.user_id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"><div className="min-w-0"><p className="break-all text-sm font-medium">{text(admin.email) || 'Email unavailable'}</p><p className="mt-1 text-xs text-ink-soft">{text(admin.role)} · {index === 0 ? 'Owner account' : 'Administrator'} · {date(admin.created_at)}</p></div>{index === 0 ? <span className="text-xs text-ink-soft">Protected owner</span> : <button type="button" disabled={busy} className={softButton} onClick={() => { if (window.confirm('Remove administrator access for this account?')) void run(async () => { const { data, error: rpcError } = await requireSupabase().rpc('admin_manage_access', { p_action: 'remove', p_email: null, p_user_id: admin.user_id }); if (rpcError) throw rpcError; setRows((current) => ({ ...current, admins: (data ?? []) as Row[] })) }, 'Administrator access removed.') }}>Remove access</button>}</div>)}{!(rows.admins ?? []).length ? <p className="px-5 py-8 text-sm text-ink-soft">No administrator accounts found.</p> : null}</div></section><form onSubmit={sendCustomerNotification} className="grid gap-3 border border-border bg-card p-6"><h2 className="display text-xl">Send customer notification</h2><p className="text-xs text-ink-soft">Enter the customer's account UUID from the Customers section. This sends an in-app notification to that customer only.</p><input required className={inputClass} placeholder="Customer account ID (UUID)" value={notificationDraft.user_id} onChange={(event) => setNotificationDraft({ ...notificationDraft, user_id: event.target.value })} /><input required maxLength={160} className={inputClass} placeholder="Notification title" value={notificationDraft.title} onChange={(event) => setNotificationDraft({ ...notificationDraft, title: event.target.value })} /><textarea required maxLength={4000} rows={4} className={inputClass} placeholder="Notification message" value={notificationDraft.body} onChange={(event) => setNotificationDraft({ ...notificationDraft, body: event.target.value })} /><button disabled={busy} className={buttonClass}>Send notification <ArrowRight /></button></form><DataTable title="Customer notifications" rows={rows.notifications ?? []} columns={['user_id','title','body','read_at','created_at']} /></div> : null}

            {section === 'support' ? <div className="grid gap-5"><form onSubmit={saveTelegramSupport} className="grid gap-3 border border-border bg-card p-5"><h2 className="display text-xl">Telegram customer support</h2><p className="text-xs text-ink-soft">Customers will see a Telegram button on their support page. Enter the Telegram username without @. You can change it here at any time.</p><input aria-label="Telegram support username" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={inputClass} value={telegramUsername} onChange={(event) => setTelegramUsername(event.target.value.replace(/\s/g, ''))} placeholder="Telegram username (e.g. MsheirebSupport)" maxLength={33} />{telegramUsername.trim().replace(/^@/, '') ? <a href={`https://t.me/${encodeURIComponent(telegramUsername.trim().replace(/^@/, ''))}`} target="_blank" rel="noopener noreferrer" className="text-sm text-brass underline underline-offset-4">Preview customer Telegram link</a> : <p className="text-xs text-ink-soft">Leave the username empty and save to remove the Telegram button from the customer page.</p>}<button disabled={busy} className={buttonClass}>Save Telegram contact <ArrowRight /></button></form><section className="grid gap-5 lg:grid-cols-[minmax(16rem,0.7fr)_1.3fr]"><div className="border border-border bg-card"><div className="grid gap-3 border-b border-border p-4"><div><h2 className="display text-xl">Support conversations</h2><p className="mt-1 text-xs text-ink-soft">Showing {filteredSupportThreads.length} of {(rows.threads ?? []).length} conversations</p></div><input aria-label="Search support conversations" className={inputClass} placeholder="Search customer ID, subject or conversation ID" value={supportSearch} onChange={(event) => setSupportSearch(event.target.value)} /><div className="flex flex-wrap gap-2"><select aria-label="Filter support status" className={inputClass} value={supportStatus} onChange={(event) => setSupportStatus(event.target.value)}><option value="all">All statuses</option>{Array.from(new Set((rows.threads ?? []).map((thread) => text(thread.status || 'open').toLowerCase()))).sort().map((status) => <option key={status} value={status}>{status}</option>)}</select><button type="button" className={softButton} onClick={() => { setSupportSearch(''); setSupportStatus('all') }}>Clear filters</button></div></div><div className="divide-y divide-border">{filteredSupportThreads.map((thread) => <button key={thread.id} onClick={() => setSelectedThread(text(thread.id))} className={selectedThread === thread.id ? 'block w-full bg-brass/10 px-5 py-4 text-left' : 'block w-full px-5 py-4 text-left hover:bg-brass/5'}><b className="block text-xs">{text(thread.customer_name) || 'Unknown customer'}</b><span className="mt-1 block break-all text-[0.65rem] text-ink-soft">{text(thread.subject) || 'Support conversation'} · {text(thread.status || 'open')} · {date(thread.updated_at)}</span><span className="mt-1 block break-all text-[0.58rem] text-ink-soft">{text(thread.user_id)}</span></button>)}{!filteredSupportThreads.length ? <p className="p-5 text-sm text-ink-soft">No conversations match these filters.</p> : null}</div></div><SupportConversation key={selectedThread + '-' + supportMessageVersion} threadId={selectedThread} customerId={text(selectedSupportThread?.user_id)} status={text(selectedSupportThread?.status || 'open')} onStatusChange={changeSupportStatus} onSend={sendReply} reply={reply} setReply={setReply} busy={busy} /></section></div> : null}

            {section === 'settings' ? <div className="grid gap-6">
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Currency exchange rates</h2><p className="mt-1 text-xs text-ink-soft">AED value of one unit of each currency. Enter rates supplied by your finance provider.</p></div>{(rows.fx ?? []).map((item) => <form key={item.code} onSubmit={(event) => { event.preventDefault(); void run(async () => { const value = Number(fxDrafts[text(item.code)]); if (!Number.isFinite(value) || value <= 0) throw new Error('Enter a rate greater than zero.'); const { error: saveError } = await requireSupabase().from('fx_rates').update({ aed_per_unit: value, updated_at: new Date().toISOString(), updated_by: user?.id }).eq('code', item.code); if (saveError) throw saveError }, `Updated ${text(item.code)} exchange rate.`) }} className="grid items-center gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">{text(item.code)} · {text(item.label)}</label><input required type="number" min="0.00000001" step="0.00000001" className={inputClass} value={fxDrafts[text(item.code)] ?? ''} onChange={(event) => setFxDrafts({ ...fxDrafts, [text(item.code)]: event.target.value })} /><button disabled={busy} className={softButton}>Save rate</button></form>)}</section>
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Property price labels</h2><p className="mt-1 text-xs text-ink-soft">Update the public price text shown for each property slug.</p></div>{(rows.prices ?? []).map((item) => <form key={item.id} onSubmit={(event) => { event.preventDefault(); void run(async () => { const { error: saveError } = await requireSupabase().from('property_prices').update({ price_label: priceDrafts[text(item.id)], updated_at: new Date().toISOString(), updated_by: user?.id }).eq('id', item.id); if (saveError) throw saveError }, 'Property price label saved.') }} className="grid items-center gap-2 border-t border-border pt-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-sm font-medium">{text(item.slug)}</label><input required maxLength={120} className={inputClass} value={priceDrafts[text(item.id)] ?? ''} onChange={(event) => setPriceDrafts({ ...priceDrafts, [text(item.id)]: event.target.value })} /><button disabled={busy} className={softButton}>Save label</button></form>)}</section>
              <form onSubmit={createMembershipPlan} className="grid gap-3 border border-brass/40 bg-card p-5"><div><h2 className="display text-xl">Create investment plan</h2><p className="mt-1 text-xs text-ink-soft">Set the minimum investment and the editable profit and commission percentages. Percentages are estimates only and do not guarantee a return.</p></div><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"><input required maxLength={48} className={inputClass} placeholder="Plan code (e.g. level-1)" value={newPlanDraft.code} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, code: event.target.value })} /><input required maxLength={100} className={inputClass} placeholder="Plan name" value={newPlanDraft.name} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, name: event.target.value })} /><input required type="number" min="0" step="1" className={inputClass} placeholder="Level" value={newPlanDraft.level} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, level: event.target.value })} /><input required type="number" min="0" step="0.01" className={inputClass} placeholder="Minimum amount (AED)" value={newPlanDraft.minimum_amount} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, minimum_amount: event.target.value })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} placeholder="Profit percentage" value={newPlanDraft.profit_percent} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, profit_percent: event.target.value })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} placeholder="Commission percentage" value={newPlanDraft.commission_percent} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, commission_percent: event.target.value })} /></div><label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={newPlanDraft.active} onChange={(event) => setNewPlanDraft({ ...newPlanDraft, active: event.target.checked })} /> Make this plan available for new investment requests</label><button disabled={busy} className={buttonClass}>Create investment plan <ArrowRight /></button></form>
              <section className="grid gap-4 border border-border bg-card p-5"><div><h2 className="display text-xl">Membership plan settings</h2><p className="mt-1 text-xs text-ink-soft">Changing percentages changes displayed plan terms. Do not advertise guaranteed returns unless legally approved and funded.</p></div>{(rows.plans ?? []).map((item) => { const draft = planDrafts[text(item.id)] ?? { name: text(item.name), minimum_amount: text(item.minimum_amount), profit_percent: text(item.profit_percent), commission_percent: text(item.commission_percent) }; return <form key={item.id} onSubmit={(event) => { event.preventDefault(); void run(async () => { const minimum = Number(draft.minimum_amount), profit = Number(draft.profit_percent), commission = Number(draft.commission_percent); if (![minimum, profit, commission].every(Number.isFinite) || minimum < 0 || profit < 0 || commission < 0 || profit > 100 || commission > 100) throw new Error('Enter valid non-negative amounts and percentages no greater than 100.'); const { error: saveError } = await requireSupabase().from('membership_plans').update({ name: draft.name.trim(), minimum_amount: minimum, profit_percent: profit, commission_percent: commission, updated_at: new Date().toISOString(), updated_by: user?.id }).eq('id', item.id); if (saveError) throw saveError }, 'Membership plan settings saved.') }} className="grid gap-2 border-t border-border pt-4"><p className="text-sm font-medium">Level {text(item.level)} · {text(item.code)}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"><input required className={inputClass} aria-label="Plan name" value={draft.name} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, name: event.target.value } })} /><input required type="number" min="0" step="0.01" className={inputClass} aria-label="Minimum amount" placeholder="Minimum amount" value={draft.minimum_amount} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, minimum_amount: event.target.value } })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} aria-label="Profit percentage" placeholder="Profit %" value={draft.profit_percent} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, profit_percent: event.target.value } })} /><input required type="number" min="0" max="100" step="0.0001" className={inputClass} aria-label="Commission percentage" placeholder="Commission %" value={draft.commission_percent} onChange={(event) => setPlanDrafts({ ...planDrafts, [text(item.id)]: { ...draft, commission_percent: event.target.value } })} /></div><button disabled={busy} className={softButton + ' justify-self-start'}>Save plan settings</button></form> })}</section>
            </div> : null}

            <div className="mt-8 flex items-center justify-between border-t border-border pt-5"><p className="text-xs text-ink-soft">Signed in as {user?.email}</p><button type="button" disabled={busy} onClick={() => void load()} className={softButton}>Refresh data</button></div>
          </> : null}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function DataTable({ title, rows, columns, render }: { title: string; rows: Row[]; columns: string[]; render?: (row: Row) => React.ReactNode }) {
  return <section className="overflow-hidden border border-border bg-card"><div className="border-b border-border px-5 py-4"><h2 className="display text-xl">{title}</h2><p className="mt-1 text-xs text-ink-soft">{rows.length} records</p></div><div className="overflow-x-auto"><table className="w-full min-w-[42rem] text-left text-xs"><thead className="bg-muted/40 text-ink-soft"><tr>{columns.map((column) => <th key={column} className="px-4 py-3 font-medium">{column.replaceAll('_', ' ')}</th>)}{render ? <th className="px-4 py-3">Action</th> : null}</tr></thead><tbody className="divide-y divide-border">{rows.map((row) => <tr key={text(row.id)}>{columns.map((column) => <td key={column} className="max-w-64 px-4 py-3 align-top"><span className="block break-all">{column.endsWith('_at') ? date(row[column]) : column === 'payout_details' ? (typeof row[column] === 'string' ? row[column] : text(row[column]?.instructions || Object.entries(row[column] ?? {}).map(([key, value]) => `${key}: ${String(value)}`).join(' · ') || '—')) : text(row[column])}</span></td>)}{render ? <td className="px-4 py-3">{render(row)}</td> : null}</tr>)}</tbody></table>{!rows.length ? <p className="px-5 py-8 text-sm text-ink-soft">No records to display.</p> : null}</div></section>
}

function SupportConversation({ threadId, customerId, status, onStatusChange, onSend, reply, setReply, busy }: { threadId: string; customerId: string; status: string; onStatusChange: (status: 'open' | 'closed') => void; onSend: (event: FormEvent<HTMLFormElement>) => void; reply: string; setReply: (value: string) => void; busy: boolean }) {
  const [messages, setMessages] = useState<Row[]>([])
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    let active = true
    if (!threadId) { setMessages([]); return }
    void requireSupabase().from('support_messages').select('*').eq('thread_id', threadId).order('created_at').then(({ data, error }) => {
      if (!active) return
      if (error) setLoadError(error.message)
      else { setLoadError(''); setMessages((data ?? []) as Row[]) }
    })
    return () => { active = false }
  }, [threadId])
  return <div className="flex min-h-80 flex-col border border-border bg-card"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4"><div><h2 className="display text-xl">Conversation</h2><p className="mt-1 text-[0.65rem] text-ink-soft">Status: {status}</p></div>{threadId ? status.toLowerCase() === 'closed' ? <button type="button" disabled={busy} onClick={() => onStatusChange('open')} className={softButton}>Reopen conversation</button> : <button type="button" disabled={busy} onClick={() => onStatusChange('closed')} className={softButton}>Close conversation</button> : null}</div>{!threadId ? <p className="m-auto p-6 text-sm text-ink-soft">Select a support conversation.</p> : <><div className="flex-1 space-y-3 p-5">{loadError ? <p role="alert" className="text-xs text-destructive">{loadError}</p> : null}{messages.map((message) => { const fromCustomer = text(message.sender_id) === customerId; return <article key={message.id} className={fromCustomer ? 'mr-5 border border-border bg-card p-3' : 'ml-5 border border-brass/30 bg-brass/5 p-3'}><p className="mb-1 text-[0.6rem] font-semibold uppercase tracking-wider text-ink-soft">{fromCustomer ? 'Customer' : 'Admin'}</p><p className="whitespace-pre-wrap break-words text-xs leading-6">{text(message.message)}</p><p className="mt-2 text-right text-[0.6rem] text-ink-soft">{date(message.created_at)}</p></article> })}</div>{status.toLowerCase() === 'closed' ? <div className="border-t border-border bg-background p-5"><p className="text-sm text-ink-soft">This conversation is closed. Reopen it to send another reply.</p></div> : <form onSubmit={onSend} className="grid gap-3 border-t border-border p-5"><textarea required rows={3} maxLength={5000} className={inputClass} placeholder="Write a reply…" value={reply} onChange={(event) => setReply(event.target.value)} /><div className="flex items-center justify-between gap-3"><span className="text-[0.65rem] text-ink-soft">{reply.length}/5000</span><button disabled={busy || !reply.trim()} className={buttonClass}>Send reply <ArrowRight /></button></div></form>}</>}</div>
}
