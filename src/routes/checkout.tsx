import { createFileRoute, Link } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../components/site-chrome'

export const Route = createFileRoute('/checkout')({ component: CheckoutPage })

function CheckoutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pb-20 pt-32 sm:px-8">
        <p className="eyebrow text-brass">Secure payments</p>
        <h1 className="display mt-3 text-4xl">Online checkout</h1>
        <div className="mt-8 border border-border bg-card p-7 sm:p-10">
          <h2 className="display text-2xl">Online payments are not enabled yet.</h2>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Payment processing has not been connected to the live website. For your security,
            do not enter card or bank details here. Contact our team to discuss a reservation.
          </p>
          <Link to="/contact" className="eyebrow mt-7 inline-flex bg-primary px-5 py-3 text-primary-foreground">Contact our team</Link>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
