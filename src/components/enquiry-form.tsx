import { useState } from 'react'
import { RESIDENCES } from '../data/site'
import { supabaseRest } from '../lib/supabase'
import { ArrowRight } from './site-chrome'

type Status = 'idle' | 'sending' | 'sent' | 'error'

export function EnquiryForm({
  residence = 'General enquiry',
  source,
  showResidenceSelect = false,
}: {
  residence?: string
  source: string
  showResidenceSelect?: boolean
}) {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    mobile: '',
    email: '',
    residence,
    message: '',
  })

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [key]: event.target.value })
    if (status === 'error') setStatus('idle')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setStatus('sending')
    try {
      await supabaseRest<unknown[]>('enquiries', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          full_name: form.name.trim(),
          mobile: form.mobile.trim(),
          email: form.email.trim() || null,
          message: [
            `Interested in: ${form.residence.trim() || 'General enquiry'}`,
            form.message.trim(),
          ].filter(Boolean).join('\n\n'),
          source,
        }),
      })
      setStatus('sent')
      setForm({ name: '', mobile: '', email: '', residence, message: '' })
    } catch (err) {
      console.error('Enquiry submission failed', err)
      setError(err instanceof Error ? err.message : 'We could not send your enquiry. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'sent') {
    return (
      <div
        data-testid="enquiry-success"
        data-state="ready"
        className="border border-brass/40 bg-card p-8 text-center soft-shadow"
      >
        <p className="eyebrow text-brass">Thank you</p>
        <h3 className="display mt-3 text-2xl">Your enquiry is with our team.</h3>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Our team will review your request and contact you using the details you provided.
        </p>
        <button
          type="button"
          onClick={() => setStatus('idle')}
          className="eyebrow link-underline mt-6 text-[0.58rem]"
        >
          Send another enquiry
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      data-testid="enquiry-form"
      data-state={status === 'sending' ? 'loading' : status === 'error' ? 'error' : 'ready'}
      className="grid gap-5 border border-border bg-card p-6 sm:p-8"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow text-[0.5rem] text-ink-soft">Full name</span>
          <input
            type="text"
            required
            value={form.name}
            onChange={update('name')}
            disabled={status === 'sending'}
            placeholder="Your name"
            data-testid="enquiry-name"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
          />
        </label>
        <label className="block">
          <span className="eyebrow text-[0.5rem] text-ink-soft">Mobile number</span>
          <input
            type="tel"
            required
            value={form.mobile}
            onChange={update('mobile')}
            disabled={status === 'sending'}
            placeholder="+971"
            data-testid="enquiry-phone"
            className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
          />
        </label>
      </div>

      <label className="block">
        <span className="eyebrow text-[0.5rem] text-ink-soft">Email (optional)</span>
        <input
          type="email"
          value={form.email}
          onChange={update('email')}
          disabled={status === 'sending'}
          placeholder="you@example.com"
          data-testid="enquiry-email"
          className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="eyebrow text-[0.5rem] text-ink-soft">Interested in</span>
        <select
          value={form.residence}
          onChange={update('residence')}
          disabled={status === 'sending' || !showResidenceSelect}
          data-testid="enquiry-residence"
          className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors focus:border-brass disabled:opacity-70"
        >
          {showResidenceSelect
            ? RESIDENCES.map((item) => (
                <option key={item.slug} value={item.name}>
                  {item.name}
                </option>
              ))
            : null}
          <option value={residence}>{residence}</option>
          {showResidenceSelect ? <option value="General enquiry">General enquiry</option> : null}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow text-[0.5rem] text-ink-soft">Message</span>
        <textarea
          rows={4}
          value={form.message}
          onChange={update('message')}
          disabled={status === 'sending'}
          placeholder="Preferred date and time for a visit"
          data-testid="enquiry-message"
          className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
        />
      </label>

      {error ? (
        <p role="alert" data-testid="enquiry-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-xs text-xs leading-relaxed text-ink-soft">
          Your details are used only to respond to this enquiry.
        </p>
        <button
          type="submit"
          disabled={status === 'sending'}
          data-testid="enquiry-submit"
          className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
        >
          {status === 'sending' ? 'Sending…' : 'Request a callback'}
          <ArrowRight />
        </button>
      </div>
    </form>
  )
}
