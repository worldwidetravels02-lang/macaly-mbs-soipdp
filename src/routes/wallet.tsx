import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useEffect, useState } from 'react'
import { api } from '@/convex/_generated/api'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { errorMessage } from '../lib/errors'
import { formatAed, formatDate } from '../lib/format'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/wallet']

export const Route = createFileRoute('/wallet')({
  head: () => {
    const canonical = canonicalUrl('/wallet')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: WalletPage,
})

const fieldClass =
  'mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none transition-colors placeholder:text-ink-soft/60 focus:border-brass disabled:opacity-60'

function WalletPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
          <AuthLoading>
            <div data-testid="wallet-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
              Checking your session…
            </div>
          </AuthLoading>

          <Unauthenticated>
            <div data-testid="wallet-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Investment wallet</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Sign in to open your wallet.</h1>
              <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
                Members receive an AED 200 sign-in bonus, track their balance in AED and can request
                top-ups or withdrawals at any time.
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
            <WalletPanel />
          </Authenticated>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}

function WalletPanel() {
  const ensureWallet = useMutation(api.wallet.ensureWallet)
  const wallet = useQuery(api.wallet.myWallet)
  const verification = useQuery(api.verifications.myVerification)
  const standing = useQuery(api.accountState.myState)
  const generateUploadUrl = useMutation(api.verifications.generateUploadUrl)
  const paymentDetails = useQuery(api.cryptoPayments.details)
  const submitCrypto = useMutation(api.cryptoPayments.submit)
  const myCryptoPayments = useQuery(api.cryptoPayments.mine)
  const submitVerification = useMutation(api.verifications.submitVerification)
  const profitPayouts = useQuery(api.profitPayouts.myPayouts)

  const [error, setError] = useState<string | null>(null)
  const [verifyDraft, setVerifyDraft] = useState({ type: 'Emirates ID', note: '' })
  const [verifyFile, setVerifyFile] = useState<File | null>(null)
  const [verifyState, setVerifyState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null)
  const [cryptoDraft, setCryptoDraft] = useState({ amount: '', coin: '', txHash: '', note: '' })
  const [cryptoFile, setCryptoFile] = useState<File | null>(null)
  const [cryptoState, setCryptoState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [cryptoError, setCryptoError] = useState<string | null>(null)

  useEffect(() => {
    ensureWallet().catch((err) => console.error('Could not prepare wallet', err))
  }, [ensureWallet])

  if (wallet === undefined) {
    return (
      <div data-testid="wallet-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
        Loading your wallet…
      </div>
    )
  }

  if (wallet === null) {
    return (
      <div data-testid="wallet-signed-out" className="border border-border bg-card p-8 text-sm text-ink-soft">
        Sign in to view your wallet.
      </div>
    )
  }

  const verified = verification?.status === 'approved'

  const submitVerificationDocument = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setVerifyNotice(null)
    if (!verifyFile) {
      setError('Attach a photo or PDF of your government document')
      return
    }
    setVerifyState('sending')
    try {
      const uploadUrl = await generateUploadUrl()
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': verifyFile.type || 'application/octet-stream' },
        body: verifyFile,
      })
      if (!response.ok) throw new Error('The document could not be uploaded')
      const { storageId } = (await response.json()) as { storageId: string }
      await submitVerification({
        documentId: storageId as never,
        documentName: verifyFile.name,
        documentType: verifyDraft.type,
        note: verifyDraft.note || undefined,
      })
      setVerifyFile(null)
      setVerifyDraft({ type: verifyDraft.type, note: '' })
      setVerifyState('sent')
      setVerifyNotice('Document received. Administration reviews identity checks before payments.')
    } catch (err) {
      setError(errorMessage(err, 'Could not submit your document'))
      setVerifyState('error')
    }
  }

  return (
    <div data-testid="wallet-panel" data-state="ready" className="grid gap-8">
      <header className="flex flex-col gap-6 border-b border-border pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="eyebrow text-brass">Investment wallet</p>
          <p className="display mt-3 text-[clamp(1.8rem,4vw,2.6rem)]">Your investment wallet</p>
          <p className="mt-2 text-sm text-ink-soft">
            Holdings, profit and records for this account.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <div>
            <dt className="eyebrow text-[0.5rem] text-ink-soft">Membership</dt>
            <dd data-testid="wallet-tier" className="display mt-2 text-lg">{wallet.tier.name}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.5rem] text-ink-soft">Top-ups approved</dt>
            <dd className="display mt-2 text-lg">{formatAed(wallet.totalTopUpAed)}</dd>
          </div>
          <div>
            <dt className="eyebrow text-[0.5rem] text-ink-soft">Withdrawn</dt>
            <dd className="display mt-2 text-lg">{formatAed(wallet.totalWithdrawnAed)}</dd>
          </div>
        </dl>
      </header>

      <div data-testid="wallet-bonus" className="flex flex-col gap-3 border border-brass/40 bg-brass/5 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow text-[0.5rem] text-brass">Sign-in bonus</p>
          <p className="mt-2 text-sm text-ink-soft">
            {formatAed(wallet.signInBonusAed)} credited when you joined
            {wallet.bonusAed > 0 ? ` · ${formatAed(wallet.bonusAed)} received` : ''}
          </p>
        </div>
        <div data-testid="wallet-level-progress" className="w-full sm:max-w-xs">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Your level</p>
          <p data-testid="wallet-level" className="display mt-1 text-lg">
            Level {wallet.tier.level}
          </p>
          <p data-testid="wallet-next-level" className="mt-2 text-sm text-ink-soft">
            {wallet.nextTier
              ? `Levels are set by administration. ${wallet.nextTier.name} is the next step.`
              : 'Top membership level reached.'}
          </p>
        </div>
      </div>

      {standing && standing.status !== 'active' ? (
        <p
          role="status"
          data-testid="wallet-standing"
          className={[
            'border px-5 py-4 text-sm',
            standing.status === 'blocked'
              ? 'border-destructive/40 bg-destructive/5 text-destructive'
              : 'border-brass/50 bg-brass/5 text-ink-soft',
          ].join(' ')}
        >
          {standing.status === 'blocked'
            ? 'Your account is blocked by administration. Payments are closed.'
            : 'Your assets are frozen by administration. Payments and withdrawals are paused.'}
          {standing.reason ? ` ${standing.reason}` : ''}
        </p>
      ) : null}

      <section
        data-testid="verify-panel"
        data-state={verification === undefined ? 'loading' : 'ready'}
        className="border border-border bg-card"
      >
        <div className="flex flex-col gap-4 border-b border-border px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="eyebrow text-brass">Identity verification</p>
            <h2 className="display mt-3 text-2xl">Government proof of identity</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-soft">
              Every member uploads one government document before the first payment. Administration
              checks it, and payments open once it is approved.
            </p>
          </div>
          <span
            data-testid="verify-status"
            className={[
              'eyebrow shrink-0 px-3 py-2 text-[0.5rem]',
              verified
                ? 'bg-brass text-deep'
                : verification?.status === 'pending'
                  ? 'border border-brass/50 text-brass'
                  : verification?.status === 'rejected'
                    ? 'border border-destructive/40 text-destructive'
                    : 'border border-border text-ink-soft',
            ].join(' ')}
          >
            {verification === undefined
              ? 'Checking'
              : verified
                ? 'Approved'
                : verification?.status === 'pending'
                  ? 'Awaiting approval'
                  : verification?.status === 'rejected'
                    ? 'Not approved'
                    : 'Not submitted'}
          </span>
        </div>

        <div className="grid gap-5 p-6">
          {verification?.reviewNote ? (
            <p data-testid="verify-review-note" className="border border-border bg-bone/60 px-4 py-3 text-sm text-ink-soft">
              Administration note: {verification.reviewNote}
            </p>
          ) : null}

          {verified ? (
            <p data-testid="verify-approved-note" className="text-sm text-ink-soft">
              Your identity is approved. Payments, top-ups and withdrawals are open.
            </p>
          ) : verification?.status === 'pending' ? (
            <p data-testid="verify-pending-note" className="text-sm text-ink-soft">
              {verification.documentType} submitted. Administration is reviewing it; payments unlock
              on approval.
            </p>
          ) : (
            <form onSubmit={submitVerificationDocument} data-testid="verify-form" className="grid gap-4">
              <p data-testid="verify-required" className="text-sm text-ink-soft">
                {verification?.status === 'rejected'
                  ? 'Your previous document was not approved. Upload a clearer copy to try again.'
                  : 'Upload a passport, Emirates ID or residency visa. Payments stay locked until approval.'}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Document type</span>
                  <select
                    value={verifyDraft.type}
                    onChange={(event) => setVerifyDraft({ ...verifyDraft, type: event.target.value })}
                    disabled={verifyState === 'sending'}
                    data-testid="verify-type"
                    className={fieldClass}
                  >
                    <option>Emirates ID</option>
                    <option>Passport</option>
                    <option>Residency visa</option>
                    <option>Driving licence</option>
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Document file</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setVerifyFile(event.target.files?.[0] ?? null)}
                    disabled={verifyState === 'sending'}
                    data-testid="verify-file"
                    className="mt-2 w-full border border-input bg-background px-3 py-2.5 text-sm outline-none file:mr-3 file:border-0 file:bg-bone file:px-3 file:py-1.5 file:text-xs focus:border-brass"
                  />
                </label>
              </div>
              <label className="block">
                <span className="eyebrow text-[0.5rem] text-ink-soft">Note for administration (optional)</span>
                <input
                  type="text"
                  value={verifyDraft.note}
                  onChange={(event) => setVerifyDraft({ ...verifyDraft, note: event.target.value })}
                  disabled={verifyState === 'sending'}
                  placeholder="Anything we should know"
                  data-testid="verify-note"
                  className={fieldClass}
                />
              </label>
              <button
                type="submit"
                disabled={verifyState === 'sending'}
                data-testid="verify-submit"
                className="eyebrow inline-flex items-center justify-between gap-8 justify-self-start bg-primary px-6 py-3.5 text-[0.58rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
              >
                {verifyState === 'sending' ? 'Uploading' : 'Submit for approval'}
              </button>
            </form>
          )}

          {verifyNotice ? (
            <p data-testid="verify-success" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft">
              {verifyNotice}
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <p role="alert" data-testid="wallet-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <section data-testid="wallet-properties" className="border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
            <div>
              <h2 className="display text-xl">Your properties</h2>
              <p className="mt-1 text-xs text-ink-soft">
                Residences held in your portfolio, with what you have placed in each.
              </p>
            </div>
            <Link to="/residences" className="eyebrow link-underline inline-flex items-center gap-2 text-[0.5rem]">
              All residences
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {wallet.properties.length === 0 ? (
            <div className="px-6 py-8">
              <p data-testid="wallet-properties-empty" className="text-sm text-ink-soft">
                No property holdings yet. Choose a residence to reserve and your holding appears here.
              </p>
              <Link
                to="/residences"
                className="eyebrow mt-5 inline-flex items-center gap-3 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
              >
                Browse residences
                <ArrowRight />
              </Link>
            </div>
          ) : (
            <ul data-testid="wallet-property-list" className="divide-y divide-border">
              {wallet.properties.map((row) => (
                <li key={row.residence} className="flex items-start justify-between gap-4 px-6 py-4">
                  <div>
                    <p className="display text-lg">{row.residence}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {row.deposits} {row.deposits === 1 ? 'deposit' : 'deposits'} recorded
                    </p>
                  </div>
                  <p className="display text-lg">{formatAed(row.totalAed)}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside data-testid="wallet-menu" className="border border-border bg-card lg:sticky lg:top-24">
          <div className="border-b border-border px-6 py-5">
            <p className="eyebrow text-brass">Your account</p>
            <p className="display mt-3 text-xl">{wallet.tier.name}</p>
            <p className="mt-1 text-sm text-ink-soft">Member account</p>
          </div>
          <nav aria-label="Wallet options">
            <ul className="divide-y divide-border">
              {[
                { label: 'Membership levels', href: '#wallet-membership', internal: false },
                { label: 'Monthly profit', href: '#wallet-profit', internal: false },
                { label: 'Deposit history', href: '#wallet-deposit-history', internal: false },
                { label: 'Withdrawal history', href: '#wallet-withdrawal-history', internal: false },
                { label: 'Wallet activity', href: '#wallet-activity', internal: false },
              ].map((item) => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    data-testid={`wallet-menu-${item.href.replace('#wallet-', '')}`}
                    className="flex items-center justify-between gap-3 px-6 py-4 text-sm transition-colors hover:text-brass"
                  >
                    {item.label}
                    <ArrowRight className="h-3 w-3" />
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/support"
                  data-testid="wallet-menu-support"
                  className="flex items-center justify-between gap-3 px-6 py-4 text-sm transition-colors hover:text-brass"
                >
                  Talk to your concierge
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
              <li>
                <Link
                  to="/account"
                  data-testid="wallet-menu-account"
                  className="flex items-center justify-between gap-3 px-6 py-4 text-sm transition-colors hover:text-brass"
                >
                  Account details
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            </ul>
          </nav>
        </aside>
      </div>

      <div className="grid gap-6">
        <form
          data-testid="crypto-form"
          data-state={cryptoState === 'sending' ? 'loading' : cryptoState === 'error' ? 'error' : 'ready'}
          className="grid gap-4 border border-border bg-card p-6"
          onSubmit={async (event) => {
            event.preventDefault()
            setCryptoError(null)
            if (!cryptoFile) {
              setCryptoError('Attach a screenshot or PDF of your payment slip')
              return
            }
            const wallet_ = paymentDetails?.crypto.find((row) => row.coin === cryptoDraft.coin)
            if (!wallet_) {
              setCryptoError('Choose the coin you paid with')
              return
            }
            setCryptoState('sending')
            try {
              const uploadUrl = await generateUploadUrl()
              const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: { 'Content-Type': cryptoFile.type || 'application/octet-stream' },
                body: cryptoFile,
              })
              if (!response.ok) throw new Error('The payment slip could not be uploaded')
              const { storageId } = (await response.json()) as { storageId: string }
              await submitCrypto({
                kind: 'topup',
                amountAed: Number(cryptoDraft.amount),
                coin: wallet_.coin,
                network: wallet_.network,
                address: wallet_.address,
                txHash: cryptoDraft.txHash || undefined,
                proofId: storageId as never,
                proofName: cryptoFile.name,
                note: cryptoDraft.note || undefined,
              })
              setCryptoDraft({ amount: '', coin: cryptoDraft.coin, txHash: '', note: '' })
              setCryptoFile(null)
              setCryptoState('sent')
            } catch (err) {
              setCryptoError(errorMessage(err, 'Could not send the payment slip'))
              setCryptoState('error')
            }
          }}
        >
          <div>
            <p className="eyebrow text-brass">Crypto payment</p>
            <h2 className="display mt-3 text-2xl">Pay by crypto</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Send the amount to the administration wallet below, then upload your payment slip.
              Administration approves it before the wallet is credited.
            </p>
          </div>

          {paymentDetails && paymentDetails.crypto.length > 0 ? (
            <ul data-testid="crypto-addresses" className="grid gap-2">
              {paymentDetails.crypto.map((row) => (
                <li key={`${row.coin}-${row.network}`} className="border border-border bg-bone/40 px-4 py-3 text-sm">
                  <p className="eyebrow text-[0.45rem] text-ink-soft">
                    {row.coin} · {row.network}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs">{row.address}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border border-border bg-bone/40 px-4 py-3 text-sm text-ink-soft">
              Administration has not published a crypto wallet yet. Ask in customer service.
            </p>
          )}

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Coin paid</span>
            <select
              value={cryptoDraft.coin}
              onChange={(event) => setCryptoDraft({ ...cryptoDraft, coin: event.target.value })}
              disabled={cryptoState === 'sending'}
              data-testid="crypto-coin"
              className={fieldClass}
            >
              <option value="">Choose a coin</option>
              {(paymentDetails?.crypto ?? []).map((row) => (
                <option key={`${row.coin}-${row.network}`} value={row.coin}>
                  {row.coin} · {row.network}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Amount in AED</span>
              <input
                type="number"
                min={1}
                required
                value={cryptoDraft.amount}
                onChange={(event) => setCryptoDraft({ ...cryptoDraft, amount: event.target.value })}
                disabled={cryptoState === 'sending'}
                placeholder="5000"
                data-testid="crypto-amount"
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="eyebrow text-[0.5rem] text-ink-soft">Transaction hash</span>
              <input
                type="text"
                value={cryptoDraft.txHash}
                onChange={(event) => setCryptoDraft({ ...cryptoDraft, txHash: event.target.value })}
                disabled={cryptoState === 'sending'}
                placeholder="Optional"
                data-testid="crypto-txhash"
                className={fieldClass}
              />
            </label>
          </div>

          <label className="block">
            <span className="eyebrow text-[0.5rem] text-ink-soft">Payment slip</span>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(event) => setCryptoFile(event.target.files?.[0] ?? null)}
              disabled={cryptoState === 'sending'}
              data-testid="crypto-slip"
              className="mt-2 w-full border border-input bg-background px-4 py-3 text-sm outline-none file:mr-4 file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:text-background focus:border-brass"
            />
          </label>

          <button
            type="submit"
            disabled={cryptoState === 'sending'}
            data-testid="crypto-submit"
            className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85 disabled:opacity-60"
          >
            {cryptoState === 'sending' ? 'Uploading…' : 'Upload payment slip'}
            <ArrowRight />
          </button>

          {cryptoError ? (
            <p role="alert" data-testid="crypto-error" className="border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {cryptoError}
            </p>
          ) : null}
          {cryptoState === 'sent' ? (
            <p data-testid="crypto-success" className="border border-brass/40 bg-brass/5 px-4 py-3 text-sm text-ink-soft">
              Slip received. Administration reviews it before the wallet is credited.
            </p>
          ) : null}

          {myCryptoPayments && myCryptoPayments.length > 0 ? (
            <ul data-testid="crypto-list" className="divide-y divide-border border-t border-border pt-2">
              {myCryptoPayments.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                  <span>
                    {row.coin} · {formatAed(row.amountAed)}
                    <span className="ml-2 text-xs text-ink-soft">{formatDate(row.createdAt)}</span>
                  </span>
                  <span className="eyebrow text-[0.45rem] text-ink-soft">{row.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </form>

      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section id="wallet-membership" data-testid="wallet-membership" className="border border-border bg-card p-6">
          <p className="eyebrow text-brass">Membership</p>
          <p className="display mt-3 text-2xl">
            {wallet.tier.name}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            {wallet.nextTier
              ? `Levels are set by administration. Next step: ${wallet.nextTier.name}`
              : 'Top membership level reached'}
          </p>
          <Link to="/membership" className="eyebrow link-underline mt-4 inline-flex items-center gap-2 text-[0.5rem]">
            Membership levels
            <ArrowRight className="h-3 w-3" />
          </Link>
        </section>

        <section id="wallet-deposit-history" data-testid="wallet-deposit-history" className="border border-border bg-card">
          <h2 className="display border-b border-border px-6 py-4 text-lg">Deposit history</h2>
          {wallet.topUps.length === 0 ? (
            <p className="px-6 py-5 text-sm text-ink-soft">No deposits yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {wallet.topUps.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
                  <div>
                    <p>{formatAed(row.amountAed)}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatDate(row.createdAt)} · {row.method}
                    </p>
                  </div>
                  <span className="eyebrow text-[0.45rem] text-ink-soft">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="wallet-withdrawal-history" data-testid="wallet-withdrawal-history" className="border border-border bg-card">
          <h2 className="display border-b border-border px-6 py-4 text-lg">Withdrawal history</h2>
          {wallet.withdrawals.length === 0 ? (
            <p className="px-6 py-5 text-sm text-ink-soft">No withdrawals yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {wallet.withdrawals.map((row) => (
                <li key={row.id} className="flex items-start justify-between gap-4 px-6 py-3 text-sm">
                  <div>
                    <p>{formatAed(row.amountAed)}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatDate(row.createdAt)} · {row.iban}
                    </p>
                  </div>
                  <span className="eyebrow text-[0.45rem] text-ink-soft">{row.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section id="wallet-profit" data-testid="wallet-profit-history" className="border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div>
            <h2 className="display text-xl">Monthly profit</h2>
            <p className="mt-1 text-xs text-ink-soft">
              Credited automatically on the first of each month at your membership level percentage.
            </p>
          </div>
          <span className="eyebrow text-[0.5rem] text-brass">
            {profitPayouts ? `${formatAed(profitPayouts.totalAed)} paid` : 'Loading'}
          </span>
        </div>
        {profitPayouts === undefined ? (
          <p className="px-6 py-6 text-sm text-ink-soft">Loading profit payouts…</p>
        ) : profitPayouts.rows.length === 0 ? (
          <p data-testid="wallet-profit-empty" className="px-6 py-6 text-sm text-ink-soft">
            No profit payouts yet. Your first payout arrives after your first full month.
          </p>
        ) : (
          <ul data-testid="wallet-profit-rows" className="divide-y divide-border">
            {profitPayouts.rows.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm">{row.periodKey} · {row.planName} {row.percent}%</p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {formatDate(row.createdAt)} · {formatAed(row.basisAed)} base
                  </p>
                </div>
                <p className="display text-lg">+{formatAed(row.amountAed)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="wallet-activity" className="border border-border bg-card">
        <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-5">
          <h2 className="display text-xl">Wallet activity</h2>
          <Link to="/membership" className="eyebrow link-underline text-[0.52rem]">
            Membership levels
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {wallet.transactions.length === 0 ? (
          <p className="px-6 py-8 text-sm text-ink-soft">No wallet activity yet.</p>
        ) : (
          <ul data-testid="wallet-transactions" className="divide-y divide-border">
            {wallet.transactions.map((row) => (
              <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4">
                <div>
                  <p className="text-sm">
                    {row.type === 'bonus' ? 'Sign-in bonus' : row.type === 'topup' ? 'Top-up' : row.type === 'withdrawal' ? 'Withdrawal' : row.type === 'profit' ? 'Monthly profit' : 'Adjustment'}
                  </p>
                  <p className="mt-1 text-xs text-ink-soft">
                    {formatDate(row.createdAt)}
                    {row.note ? ` · ${row.note}` : ''}
                  </p>
                </div>
                <p className={row.type === 'withdrawal' ? 'display text-lg text-ink-soft' : 'display text-lg'}>
                  {row.type === 'withdrawal' ? '−' : '+'}
                  {formatAed(row.amountAed)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  )
}
