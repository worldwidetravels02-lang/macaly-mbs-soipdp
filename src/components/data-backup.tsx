import { useConvex } from 'convex/react'
import { useState } from 'react'
import { api } from '@/convex/_generated/api'
import { errorMessage } from '../lib/errors'
import { membersToCsv, ordersToCsv, projectsToCsv } from '../lib/csv'
import { ArrowRight } from './site-chrome'

type BackupState = 'idle' | 'loading' | 'done' | 'error'

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

/** Settings panel that downloads members, projects and orders as JSON, and orders as CSV. */
export function DataBackup() {
  const convex = useConvex()
  const [state, setState] = useState<BackupState>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const downloadJson = async () => {
    setState('loading')
    setMessage(null)

    try {
      const backup = await convex.query(api.backup.data, {})
      saveFile(
        JSON.stringify(backup, null, 2),
        'application/json;charset=utf-8',
        `backup-members-projects-orders-${new Date().toISOString().slice(0, 10)}.json`,
      )

      setState('done')
      setMessage(
        `Backup downloaded: ${backup.counts.members} members, ${backup.counts.projects} projects, ${backup.counts.orders} orders and ${backup.counts.administrators} administrator${backup.counts.administrators === 1 ? '' : 's'}.`,
      )
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the backup file. Please try again.'))
    }
  }

  const downloadCsv = async () => {
    setState('loading')
    setMessage(null)

    try {
      const backup = await convex.query(api.backup.data, {})
      saveFile(
        `\uFEFF${ordersToCsv(backup.orders)}`,
        'text/csv;charset=utf-8',
        `orders-${new Date().toISOString().slice(0, 10)}.csv`,
      )

      setState('done')
      setMessage(
        `Orders spreadsheet downloaded: ${backup.counts.orders} order${backup.counts.orders === 1 ? '' : 's'} with member, project, amount and status.`,
      )
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the orders spreadsheet. Please try again.'))
    }
  }

  const downloadMembersCsv = async () => {
    setState('loading')
    setMessage(null)

    try {
      const backup = await convex.query(api.backup.data, {})
      saveFile(
        `\uFEFF${membersToCsv(backup.members)}`,
        'text/csv;charset=utf-8',
        `members-${new Date().toISOString().slice(0, 10)}.csv`,
      )

      setState('done')
      setMessage(
        `Members spreadsheet downloaded: ${backup.counts.members} member${backup.counts.members === 1 ? '' : 's'} with name, phone, level and status.`,
      )
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the members spreadsheet. Please try again.'))
    }
  }

  const downloadProjectsCsv = async () => {
    setState('loading')
    setMessage(null)

    try {
      const backup = await convex.query(api.backup.data, {})
      saveFile(
        `\uFEFF${projectsToCsv(backup.projects)}`,
        'text/csv;charset=utf-8',
        `projects-${new Date().toISOString().slice(0, 10)}.csv`,
      )

      setState('done')
      setMessage(
        `Projects spreadsheet downloaded: ${backup.counts.projects} project${backup.counts.projects === 1 ? '' : 's'} with slug, price and last update.`,
      )
    } catch (err) {
      setState('error')
      setMessage(errorMessage(err, 'Could not build the projects spreadsheet. Please try again.'))
    }
  }

  return (
    <div data-testid="admin-backup" data-state={state} className="grid gap-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="display text-xl">Data backup</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
            Download one JSON file with every member, the project price list, every order
            (investments, reservation deposits, card payments and top-ups) and the administrator
            accounts, or download the orders or
            the member list or the project price list on their own as a CSV you can open in a
            spreadsheet. Keep the files
            somewhere safe; they contain personal contact details.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:items-end">
          <button
            type="button"
            onClick={downloadJson}
            disabled={state === 'loading'}
            data-testid="admin-backup-download"
            className="eyebrow inline-flex items-center justify-between gap-6 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {state === 'loading' ? 'Preparing…' : 'Download data backup'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={downloadCsv}
            disabled={state === 'loading'}
            data-testid="admin-backup-orders-csv"
            className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-6 py-3.5 text-[0.55rem] transition-colors hover:border-brass disabled:opacity-60"
          >
            {state === 'loading' ? 'Preparing…' : 'Download orders (CSV)'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={downloadMembersCsv}
            disabled={state === 'loading'}
            data-testid="admin-backup-members-csv"
            className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-6 py-3.5 text-[0.55rem] transition-colors hover:border-brass disabled:opacity-60"
          >
            {state === 'loading' ? 'Preparing…' : 'Download members (CSV)'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={downloadProjectsCsv}
            disabled={state === 'loading'}
            data-testid="admin-backup-projects-csv"
            className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-6 py-3.5 text-[0.55rem] transition-colors hover:border-brass disabled:opacity-60"
          >
            {state === 'loading' ? 'Preparing…' : 'Download projects (CSV)'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {message ? (
        <p
          role={state === 'error' ? 'alert' : 'status'}
          data-testid="admin-backup-message"
          className={
            state === 'error'
              ? 'border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive'
              : 'border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft'
          }
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}
