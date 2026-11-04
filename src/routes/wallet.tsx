import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

export const Route = createFileRoute('/wallet')({ component: WalletPage })

function WalletPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-32 sm:px-8">
        <p className="eyebrow text-brass">Member services</p>
        <h1 className="display mt-3 text-4xl">Investment wallet</h1>
        <div className="mt-8 border border-border bg-card p-7 sm:p-10">
          <h2 className="display text-2xl">Wallet services are not available yet.</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Online wallet balances, deposits and withdrawals are not enabled. We will publish
            these services only after secure payment processing and account verification are configured.
            No payment will be taken on this page.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/dashboard" className="eyebrow bg-primary px-5 py-3 text-primary-foreground">Member dashboard</Link>
            <Link to="/contact" className="eyebrow border border-border px-5 py-3">Contact our team</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
