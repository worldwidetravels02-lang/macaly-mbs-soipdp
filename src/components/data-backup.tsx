import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import { membersToCsv, ordersToCsv, projectsToCsv } from '../lib/csv'
import type { CsvMember, CsvOrder, CsvProject } from '../lib/csv'
import { requireSupabase } from '../lib/supabase-client'
import { ArrowRight } from './site-chrome'

type BackupState = 'idle' | 'loading' | 'done' | 'error'
type Row = Record<string, any>

function saveFile(contents: string, type: string, filename: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function loadBackup() {
  const client = requireSupabase()
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (authError) throw authError
  if (!user) throw new Error('Please sign in with your administrator account.')

  const { data: admin, error: adminError } = await client
    .from('admin_members')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (adminError) throw adminError
  if (!admin) throw new Error('Administrator access required.')

  const tables = [
    'profiles', 'admin_members', 'properties', 'enquiries', 'promotions',
    'support_threads', 'support_messages', 'notifications', 'wallet_transactions',
    'topup_requests', 'withdrawal_requests', 'investments', 'profit_payouts',
    'financial_audit_log', 'member_profiles', 'member_tasks', 'payment_details',
    'crypto_payments', 'membership_plans', 'investment_requests', 'verifications',
    'account_states', 'property_prices', 'fx_rates', 'posts', 'payments',
    'reservation_deposits', 'support_settings',
  ] as const

  const entries = await Promise.all(tables.map(async (table) => {
    const { data, error } = await client.from(table).select('*').limit(10000)
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    return [table, (data ?? []) as Row[]] as const
  }))
  const data = Object.fromEntries(entries) as Record<string, Row[]>
  const profiles = new Map((data.profiles ?? []).map((row) => [row.id, row]))
  const memberDetails = new Map((data.member_profiles ?? []).map((row) => [row.user_id, row]))
  const propertyNames = new Map((data.properties ?? []).map((row) => [row.id, row.name]))

  const members: CsvMember[] = (data.profiles ?? []).map((profile) => {
    const detail = memberDetails.get(profile.id)
    const state = (data.account_states ?? []).find((row) => row.user_id === profile.id)
    return {
      fullName: profile.full_name ?? '',
      mobile: profile.mobile ?? '',
      membershipLevel: detail?.membership_level ?? null,
      accountStatus: state?.status ?? null,
    }
  })

  const projects: CsvProject[] = (data.properties ?? []).map((property) => ({
    slug: property.slug ?? '',
    priceLabel: property.price_label ?? '',
    updatedAt: property.updated_at ? new Date(property.updated_at).getTime() : Date.now(),
  }))

  const orderRows: CsvOrder[] = []
  const addOrders = (table: string, rows: Row[], kind: string) => {
    for (const row of rows) {
      const profile = profiles.get(row.user_id)
      const propertyId = row.property_id
      const rawAmount = row.amount_charged ?? row.amount ?? 0
      orderRows.push({
        kind,
        reference: row.reference ?? row.id ?? '',
        memberName: profile?.full_name ?? '',
        memberEmail: '',
        project: (propertyId && propertyNames.get(propertyId)) || row.property_name || null,
        amountAed: Number(rawAmount) || 0,
        status: row.status ?? '',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      })
    }
  }
  addOrders('topup_requests', data.topup_requests ?? [], 'Top-up')
  addOrders('withdrawal_requests', data.withdrawal_requests ?? [], 'Withdrawal')
  addOrders('investments', data.investments ?? [], 'Investment')
  addOrders('investment_requests', data.investment_requests ?? [], 'Investment request')
  addOrders('crypto_payments', data.crypto_payments ?? [], 'Crypto payment')
  addOrders('payments', data.payments ?? [], 'Card payment')
  addOrders('reservation_deposits', data.reservation_deposits ?? [], 'Reservation deposit')

  return {
    exportedAt: new Date().toISOString(),
    source: 'Supabase',
    counts: {
      members: members.length,
      projects: projects.length,
      orders: orderRows.length,
      administrators: (data.admin_members ?? []).length,
    },
    members,
    projects,
    orders: orderRows,
    ...data,
  }
}

/** Admin-only Supabase export for application data and spreadsheet reports. */
export function DataBackup() {
  const [state, setState] = useState<BackupState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const runExport = async (format: 'json' | 'orders' | 'members' | 'projects') => {
    setState('loading')
    setMessage(null)
    try {
      const backup = await loadBackup()
      const date = new Date().toISOString().slice(0, 10)
      if (format === 'json') {
        saveFile(JSON.stringify(backup, null, 2), 'application/json;charset=utf-8', `supabase-backup-${date}.json`)
        setMessage(`Supabase backup downloaded: ${backup.counts.members} members, ${backup.counts.projects} properties, ${backup.counts.orders} financial records and ${backup.counts.administrators} administrators.`)
      } else if (format === 'orders') {
        saveFile(`\\uFEFF${ordersToCsv(backup.orders)}`, 'text/csv;charset=utf-8', `orders-${date}.csv`)
        setMessage(`Orders spreadsheet downloaded: ${backup.counts.orders} records.`)
      } else if (format === 'members') {
        saveFile(`\\uFEFF${membersToCsv(backup.members)}`, 'text/csv;charset=utf-8', `members-${date}.csv`)
        setMessage(`Members spreadsheet downloaded: ${backup.counts.members} members.`)
      } else {
        saveFile(`\\uFEFF${projectsToCsv(backup.projects)}`, 'text/csv;charset=utf-8', `properties-${date}.csv`)
        setMessage(`Properties spreadsheet downloaded: ${backup.counts.projects} properties.`)
      }
      setState('done')
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the backup file. Please try again.'))
    }
  }

  const button = (format: 'json' | 'orders' | 'members' | 'projects', label: string, testId: string, primary = false) => (
    <button
      type="button"
      onClick={() => void runExport(format)}
      disabled={state === 'loading'}
      data-testid={testId}
      className={`eyebrow inline-flex items-center justify-between gap-6 px-6 py-3.5 text-[0.55rem] transition-colors disabled:opacity-60 ${primary ? 'bg-primary text-primary-foreground hover:bg-ink/85' : 'border border-border hover:border-brass'}`}
    >
      {state === 'loading' ? 'Preparing…' : label}
      <ArrowRight className="h-3.5 w-3.5" />
    </button>
  )

  return (
    <div data-testid="admin-backup" data-state={state} className="grid gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="display text-xl">Data backup</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Export application records directly from Supabase: customer profiles, properties,
            enquiries, support, promotions, wallet and payment records, investments, settings
            and administrator records. JSON includes the complete selected application tables;
            CSV reports are available separately. Store exports securely because they contain
            personal and financial information. Authentication passwords and secret keys are never exported.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          {button('json', 'Download Supabase backup', 'admin-backup-download', true)}
          {button('orders', 'Download orders (CSV)', 'admin-backup-orders-csv')}
          {button('members', 'Download members (CSV)', 'admin-backup-members-csv')}
          {button('projects', 'Download properties (CSV)', 'admin-backup-projects-csv')}
        </div>
      </div>
      {message ? (
        <p role={state === 'error' ? 'alert' : 'status'} data-testid="admin-backup-message"
          className={state === 'error'
            ? 'border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
            : 'border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft'}>
          {message}
        </p>
      ) : null}
    </div>
  )
}
