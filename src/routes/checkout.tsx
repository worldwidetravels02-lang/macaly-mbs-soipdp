import { createFileRoute, Link } from '@tanstack/react-router'
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { loadStripe, type Stripe } from '@stripe/stripe-js'
import { useCallback, useEffect, useState } from 'react'
import { SiteHeader } from '../components/site-chrome'
import { CURRENCIES, formatMoney } from '../lib/currency'
import { errorMessage } from '../lib/errors'
import { requireSupabase } from '../lib/supabase-client'

type CheckoutSearch = {
  kind: 'topup' | 'deposit'
  amount: number
  currency: string
  residence?: string
}

export const Route = createFileRoute('/checkout')({
  validateSearch: (search: Record<string, unknown>): CheckoutSearch => {
    const kind = search.kind === 'deposit' ? 'deposit' : 'topup'
    const amount = Number(search.amount)
    const currency = typeof search.currency === 'string' ? search.currency.toUpperCase() : 'AED'
    return {
      kind,
      amount: Number.isFinite(amount) ? amount : 0,
      currency,
      residence: typeof search.residence === 'string' ? search.residence : undefined,
    }
  },
  component: CheckoutPage,
})

let stripePromise: Promise<Stripe | null> | null = null

function getStripe() {
  if (!stripePromise) {
    const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
    stripePromise = key ? loadStripe(key) : Promise.resolve(null)
  }
  return stripePromise
}

function CheckoutPage() {
  const { kind, amount, currency, residence } = Route.useSearch()
  const [mounted, setMounted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchClientSecret = useCallback(async () => {
    try {
      const { data, error: checkoutError } = await requireSupabase().functions.invoke<{ clientSecret: string }>(
        'create-checkout-session',
        { body: { kind, amountAed: amount, currency, residence } },
      )
      if (checkoutError) throw checkoutError
      if (!data?.clientSecret) throw new Error('The payment service did not return a checkout session.')
      setError(null)
      return data.clientSecret
    } catch (err) {
      setError(errorMessage(err, 'Could not start the payment'))
      throw err
    }
  }, [kind, amount, currency, residence])

  const label = CURRENCIES.find((entry) => entry.code === currency)?.label ?? currency

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main" className="pb-20 pt-28 sm:pt-36">
        <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
          <p className="eyebrow text-brass">Secure checkout</p>
          <h1 className="display mt-4 text-[clamp(1.9rem,3.4vw,2.8rem)]">
            {kind === 'deposit' ? 'Reservation deposit' : 'Wallet top-up'}
          </h1>
          <p className="mt-3 max-w-lg text-[0.98rem] leading-relaxed text-ink-soft">
            {kind === 'deposit'
              ? `Reserving ${residence ?? 'your residence'} with a deposit.`
              : 'Adding funds to your investment wallet.'}{' '}
            Paying in {label}.
          </p>

          <div
            data-testid="checkout-panel"
            data-state={!mounted ? 'loading' : error ? 'error' : 'ready'}
            className="mt-10 border border-border bg-card p-4 sm:p-6"
          >
            {!mounted ? (
              <p className="py-16 text-center text-sm text-ink-soft">Preparing the payment form…</p>
            ) : error ? (
              <div className="py-10 text-center">
                <p role="alert" data-testid="checkout-error" className="text-sm text-destructive">
                  {error}
                </p>
                <Link to="/wallet" className="eyebrow mt-6 inline-block text-[0.55rem] text-brass">
                  Back to wallet
                </Link>
              </div>
            ) : (
              <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>

          <p className="mt-6 text-xs leading-relaxed text-ink-soft">
            Your card is charged in {currency}. The wallet credit is calculated in AED using the
            current exchange rate configured by the administrator.
          </p>
        </div>
      </main>
    </div>
  )
}
