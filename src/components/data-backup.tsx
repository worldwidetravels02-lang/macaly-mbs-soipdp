import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import { requireSupabase } from '../lib/supabase-client'
import { ArrowRight } from './site-chrome'

type BackupState = 'idle' | 'loading' | 'done' | 'error'
type Row = Record<string, unknown>

function saveFile(contents: string, filename: string) {
  const blob = new Blob([contents], { type: 'application/json;charset=utf-8' })
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
    'membership_plans', 'investment_requests', 'verifications',
    'account_states', 'property_prices', 'fx_rates', 'posts', 'payments',
    'reservation_deposits', 'support_settings',
  ] as const

  const entries = await Promise.all(tables.map(async (table) => {
    const { data, error } = await client.from(table).select('*').limit(10000)
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    return [table, (data ?? []) as Row[]] as const
  }))

  return {
    exportedAt: new Date().toISOString(),
    source: 'Supabase',
    tables: Object.fromEntries(entries),
  }
}

/** Admin-only JSON backup of application records. */
export function DataBackup() {
  const [state, setState] = useState<BackupState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const runExport = async () => {
    setState('loading')
    setMessage(null)
    try {
      const backup = await loadBackup()
      const date = new Date().toISOString().slice(0, 10)
      saveFile(JSON.stringify(backup, null, 2), `supabase-backup-${date}.json`)
      const tableCount = Object.keys(backup.tables).length
      setMessage(`Supabase JSON backup downloaded: ${tableCount} application tables. Store it securely because it contains personal and financial information.`)
      setState('done')
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the backup file. Please try again.'))
    }
  }

  return (
    <div data-testid="admin-backup" data-state={state} className="grid gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="display text-xl">Data backup</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Download an administrator-only JSON backup of application records from Supabase.
            The file contains personal and financial information; store it securely.
            Authentication passwords and secret keys are never exported.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void runExport()}
          disabled={state === 'loading'}
          data-testid="admin-backup-download"
          className="eyebrow inline-flex items-center justify-between gap-6 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
        >
          {state === 'loading' ? 'Preparing…' : 'Download Supabase backup'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
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
