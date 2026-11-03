import { useAuthActions } from '@convex-dev/auth/react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { AuthLoading, Authenticated, Unauthenticated, useMutation, useQuery } from 'convex/react'
import { useEffect } from 'react'
import { api } from '@/convex/_generated/api'
import { ArrowRight, SiteFooter, SiteHeader } from '../components/site-chrome'
import { RESIDENCES, RESIDENCE_PATHS, SITE } from '../data/site'
import { formatAed, formatDate } from '../lib/format'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/account']

export const Route = createFileRoute('/account')({
  head: () => {
    const canonical = canonicalUrl('/account')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AccountPage,
})

function AccountPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-5xl px-5 sm:px-8">
          <AuthLoading>
            <div data-testid="account-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
              Checking your session…
            </div>
          </AuthLoading>

          <Unauthenticated>
            <div data-testid="account-signed-out" className="border border-border bg-card p-8 sm:p-12">
              <p className="eyebrow text-brass">Member portal</p>
              <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">You are not signed in.</h1>
              <p className="mt-4 max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
                Sign in to view your booking, download allotment papers and reach your concierge. If
                you have not registered yet, creating an account takes a moment.
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
  const { signOut } = useAuthActions()
  const navigate = useNavigate()
  const member = useQuery(api.members.me)
  const ensureWallet = useMutation(api.wallet.ensureWallet)
  const wallet = useQuery(api.wallet.myWallet)
  const adminStatus = useQuery(api.admin.status)

  useEffect(() => {
    ensureWallet().catch((err) => console.error('Could not prepare wallet', err))
  }, [ensureWallet])

  const handleSignOut = async () => {
    await signOut()
    await navigate({ to: '/' })
  }

  if (member === undefined) {
    return (
      <div data-testid="account-loading" className="border border-border bg-card p-10 text-center text-sm text-ink-soft">
        Loading your account…
      </div>
    )
  }

  const displayName = member?.profile?.fullName ?? member?.name ?? 'Member'

  return (
    <div data-testid="account-dashboard" data-state="ready" className="grid gap-8">
      <header className="flex flex-col gap-4 border-b border-border pb-8 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow text-brass">Member portal</p>
          <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">Welcome, {displayName}.</h1>
          <p className="mt-3 text-sm text-ink-soft">
            {member?.email ?? 'Signed in'}
            {member?.profile?.mobile ? ` · ${member.profile.mobile}` : ''}
          </p>
          <p data-testid="account-balance" className="mt-4 text-sm text-ink-soft">
            {wallet ? wallet.tier.name : 'Level 1 · Resident'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          data-testid="sign-out"
          className="eyebrow inline-flex items-center justify-between gap-6 border border-border px-5 py-3 text-[0.58rem] transition-colors hover:border-brass"
        >
          Sign out
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </header>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="border border-border bg-card p-6">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Your details</p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Name</dt>
              <dd className="text-right">{member?.profile?.fullName ?? member?.name ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Email</dt>
              <dd className="text-right">{member?.email ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Mobile</dt>
              <dd className="text-right">{member?.profile?.mobile ?? '—'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-soft">Referral code</dt>
              <dd className="text-right">{member?.profile?.referralCode ?? '—'}</dd>
            </div>
          </dl>
        </div>

        <div className="border border-border bg-card p-6">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Your advisor</p>
          <p className="display mt-4 text-xl">{SITE.name} residential team</p>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Available {SITE.hours} for viewings, paperwork and service requests.
          </p>
          <Link to="/contact" className="eyebrow link-underline mt-6 text-[0.58rem]">
            Request a callback
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div data-testid="account-wallet" className="border border-brass/40 bg-brass/5 p-6">
          <p className="eyebrow text-[0.5rem] text-brass">Investment wallet</p>
          <p className="display mt-3 text-2xl">{wallet ? wallet.tier.name : 'Level 1 · Resident'}</p>
          <p className="mt-2 text-sm text-ink-soft">
            {wallet && wallet.pendingWithdrawalAed > 0 ? `${formatAed(wallet.pendingWithdrawalAed)} held for withdrawal` : 'Membership and holdings'}
            {wallet && wallet.pendingWithdrawalAed > 0
              ? ` · ${formatAed(wallet.pendingWithdrawalAed)} held for withdrawal`
              : ''}
          </p>
          <div className="mt-5 flex flex-wrap gap-4">
            <Link to="/wallet" className="eyebrow link-underline text-[0.55rem]">
              Open wallet
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/membership" className="eyebrow link-underline text-[0.55rem]">
              Membership
              <ArrowRight className="h-3 w-3" />
            </Link>
            <Link to="/support" className="eyebrow link-underline text-[0.55rem]">
              Customer service
              <ArrowRight className="h-3 w-3" />
            </Link>
            {adminStatus?.isAdmin ? (
              <Link to="/admin" className="eyebrow link-underline text-[0.55rem]">
                Administration
                <ArrowRight className="h-3 w-3" />
              </Link>
            ) : null}
          </div>
        </div>

        <div className="border border-border bg-card p-6">
          <p className="eyebrow text-[0.5rem] text-ink-soft">Sign-in bonus</p>
          <p className="display mt-3 text-2xl">{formatAed(200)}</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Credited to your wallet when you joined. Approved top-ups move you toward the next
            membership level.
          </p>
        </div>
      </div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="display text-2xl">Your investment properties</h2>
          <Link to="/wallet" className="eyebrow link-underline text-[0.55rem]">
            Add funds
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {wallet && wallet.properties.length > 0 ? (
          <ul data-testid="account-properties" className="mt-6 grid gap-4 sm:grid-cols-2">
            {wallet.properties.map((item) => {
              const residence = RESIDENCES.find((row) => row.name === item.residence)
              return (
                <li key={item.residence} className="flex gap-4 border border-border bg-card p-4">
                  {residence ? (
                    <img
                      src={residence.image}
                      alt={residence.alt}
                      className="h-20 w-24 shrink-0 object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="min-w-0">
                    <p className="display text-lg">{item.residence}</p>
                    <p className="eyebrow mt-1 text-[0.48rem] text-brass">
                      {residence ? residence.area : 'Dubai'}
                    </p>
                    <p className="mt-2 text-sm text-ink-soft">
                      {formatAed(item.totalAed)} invested · {item.deposits}{' '}
                      {item.deposits === 1 ? 'deposit' : 'deposits'}
                    </p>
                    {residence ? (
                      <Link
                        to={RESIDENCE_PATHS[residence.slug]}
                        className="eyebrow link-underline mt-3 text-[0.5rem]"
                      >
                        View residence
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-4 border border-border bg-card px-6 py-5 text-sm text-ink-soft">
            No investment property yet. Choose a residence when you record your first top-up.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-border bg-card">
          <h2 className="display border-b border-border px-6 py-5 text-xl">Deposit history</h2>
          {wallet && wallet.topUps.length > 0 ? (
            <ul data-testid="account-deposits" className="divide-y divide-border">
              {wallet.topUps.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                  <div>
                    <p>{formatAed(row.amountAed)}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatDate(row.createdAt)} · {row.method}
                      {row.residence ? ` · ${row.residence}` : ''}
                    </p>
                  </div>
                  <span className="eyebrow text-[0.5rem] text-ink-soft">{row.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-ink-soft">No deposits recorded yet.</p>
          )}
        </section>

        <section className="border border-border bg-card">
          <h2 className="display border-b border-border px-6 py-5 text-xl">Withdrawal history</h2>
          {wallet && wallet.withdrawals.length > 0 ? (
            <ul data-testid="account-withdrawals" className="divide-y divide-border">
              {wallet.withdrawals.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                  <div>
                    <p>{formatAed(row.amountAed)}</p>
                    <p className="mt-1 text-xs text-ink-soft">
                      {formatDate(row.createdAt)} · {row.iban.slice(-4).padStart(row.iban.length, '•')}
                    </p>
                  </div>
                  <span className="eyebrow text-[0.5rem] text-ink-soft">{row.status}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-6 py-6 text-sm text-ink-soft">No withdrawals requested yet.</p>
          )}
        </section>
      </div>

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="display text-2xl">Residences to preview</h2>
          <Link to="/residences" className="eyebrow link-underline text-[0.55rem]">
            All residences
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {RESIDENCES.map((residence) => (
            <li key={residence.slug} className="border border-border bg-card">
              <img src={residence.image} alt={residence.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
              <div className="p-5">
                <p className="display text-lg">{residence.name}</p>
                <p className="eyebrow mt-2 text-[0.5rem] text-brass">{residence.area}</p>
                <Link
                  to={RESIDENCE_PATHS[residence.slug]}
                  className="eyebrow link-underline mt-4 text-[0.52rem]"
                >
                  View
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
