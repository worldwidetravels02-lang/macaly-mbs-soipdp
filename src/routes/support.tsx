import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/convex/_generated/api'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { formatAed, formatDate } from '../lib/format'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/support']

export const Route = createFileRoute('/support')({
  head: () => {
    const canonical = canonicalUrl('/support')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: SupportPage,
})

function SupportPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
          <AuthLoading>
            <div data-testid="support-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
              Checking your session…
            </div>
          </AuthLoading>

          <Unauthenticated>
            <div data-testid="support-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Customer service</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Sign in to open the chat.</h1>
              <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
                Members can message the administration team about wallet top-ups, withdrawals,
                membership levels or a residence.
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
            <SupportChat />
          </Authenticated>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function SupportChat() {
  const thread = useQuery(api.support.myThread)
  const sendMessage = useMutation(api.support.sendMessage)
  const markMemberRead = useMutation(api.support.markMemberRead)
  const wallet = useQuery(api.wallet.myWallet)
  const paymentDetails = useQuery(api.cryptoPayments.details)

  const [body, setBody] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    markMemberRead().catch((err) => console.error('Could not clear support badge', err))
  }, [markMemberRead, thread?.messages.length])

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [thread?.messages.length])

  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setState('sending')
    try {
      await sendMessage({ body })
      setBody('')
      setState('idle')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message')
      setState('error')
    }
  }

  return (
    <div data-testid="support-panel" data-state="ready" className="grid gap-6">
      <section data-testid="support-payment-details" className="border border-border bg-card p-6">
        <p className="eyebrow text-brass">Payment details from administration</p>
        <h2 className="display mt-3 text-xl">Bank and crypto accounts</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Deposits are paid to these accounts only. Send the payment, then upload the slip in your
          wallet so administration can approve and credit you.
        </p>

        {paymentDetails && (paymentDetails.bankName || paymentDetails.iban) ? (
          <dl data-testid="support-bank-details" className="mt-4 grid gap-2 border border-border bg-bone/40 px-4 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="eyebrow text-[0.45rem] text-ink-soft">Bank</dt>
              <dd>{paymentDetails.bankName || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.45rem] text-ink-soft">Account name</dt>
              <dd>{paymentDetails.accountName || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.45rem] text-ink-soft">Account number</dt>
              <dd>{paymentDetails.accountNumber || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.45rem] text-ink-soft">IBAN</dt>
              <dd>{paymentDetails.iban || 'Not provided'}</dd>
            </div>
            <div>
              <dt className="eyebrow text-[0.45rem] text-ink-soft">SWIFT</dt>
              <dd>{paymentDetails.swift || 'Not provided'}</dd>
            </div>
          </dl>
        ) : (
          <p data-testid="support-bank-empty" className="mt-4 border border-border bg-bone/40 px-4 py-3 text-sm text-ink-soft">
            Bank details have not been published yet.
          </p>
        )}

        {paymentDetails?.note ? (
          <p className="mt-3 text-xs text-ink-soft">{paymentDetails.note}</p>
        ) : null}

        {paymentDetails && paymentDetails.crypto.length > 0 ? (
          <ul data-testid="support-crypto-details" className="mt-4 grid gap-2">
            {paymentDetails.crypto.map((row) => (
              <li key={`${row.coin}-${row.network}`} className="border border-border bg-bone/40 px-4 py-3 text-sm">
                <p className="eyebrow text-[0.45rem] text-ink-soft">
                  {row.coin} · {row.network}
                </p>
                <p className="mt-1 break-all font-mono text-xs">{row.address}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <header className="border-b border-border pb-6">
        <p className="eyebrow text-brass">Customer service</p>
        <h1 className="display mt-3 text-[clamp(1.9rem,3.4vw,2.8rem)]">Chat with our team</h1>
        <p className="mt-3 max-w-lg text-sm leading-relaxed text-ink-soft">
          Messages are answered by the administration team. Every conversation is kept on your
          account so you can pick it up later.
        </p>
        <div className="mt-4 flex flex-wrap gap-6 text-sm text-ink-soft">
          <span>
            Wallet{' '}
            <strong className="font-normal text-foreground">
              {wallet ? formatAed(wallet.balanceAed) : '—'}
            </strong>
          </span>
          <span>
            Level{' '}
            <strong className="font-normal text-foreground">
              {wallet ? wallet.tier.name : '—'}
            </strong>
          </span>
          <Link to="/wallet" className="eyebrow link-underline text-[0.52rem]">
            Open wallet
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </header>

      <div className="flex min-h-[22rem] flex-col border border-border bg-card">
        <div data-testid="support-messages" className="flex-1 space-y-4 p-5 sm:p-6">
          {thread === undefined ? (
            <p className="text-sm text-ink-soft">Loading your conversation…</p>
          ) : thread === null || thread.messages.length === 0 ? (
            <div className="border border-border bg-bone/40 p-5 text-sm leading-relaxed text-ink-soft">
              No messages yet. Ask us about a top-up, a withdrawal, your membership level or a
              residence, and administration will reply here.
            </div>
          ) : (
            thread.messages.map((message) => {
              const isMember = message.authorRole === 'member'
              return (
                <div
                  key={message.id}
                  data-testid={`support-message-${message.authorRole}`}
                  className={isMember ? 'flex justify-end' : 'flex justify-start'}
                >
                  <div
                    className={[
                      'max-w-[85%] px-4 py-3 text-sm leading-relaxed',
                      isMember
                        ? 'bg-primary text-primary-foreground'
                        : 'border border-border bg-background text-foreground',
                    ].join(' ')}
                  >
                    <p className="eyebrow text-[0.45rem] opacity-70">
                      {isMember ? 'You' : 'Administration'} · {formatDate(message.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap">{message.body}</p>
                  </div>
                </div>
              )
            })
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={send} className="border-t border-border p-4 sm:p-5">
          {error ? (
            <p role="alert" data-testid="support-error" className="mb-3 border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Your message</span>
            <textarea
              rows={3}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              disabled={state === 'sending'}
              placeholder="How can we help?"
              data-testid="support-input"
              className="mt-2 w-full resize-none border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60"
            />
          </label>
          <button
            type="submit"
            disabled={state === 'sending'}
            data-testid="support-send"
            className="eyebrow mt-3 inline-flex items-center justify-between gap-8 bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {state === 'sending' ? 'Sending…' : 'Send to administration'}
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </form>
      </div>
    </div>
  )
}
