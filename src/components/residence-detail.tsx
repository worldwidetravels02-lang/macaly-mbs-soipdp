import { Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { requireSupabase } from '@/lib/supabase-client'
import { EnquiryForm } from './enquiry-form'
import { FloorPlanSection } from './floor-plan'
import { ListingsGate } from './listings-gate'
import { Reveal } from './reveal'
import { ArrowRight, SiteFooter, SiteHeader } from './site-chrome'
import { RESIDENCES, RESIDENCE_PATHS, type ResidenceSlug } from '../data/site'
import { useResidencePrice } from '../lib/prices'
import { useOffer } from '../lib/offers'
import {
} from '../lib/currency'

type InvestmentPlan = {
  code: string
  name: string
  minimum_amount: number
  profit_percent: number
  commission_percent: number
}
type InvestmentRequest = {
  id: string
  property_name: string
  amount: number
  status: string
}

export function ResidenceDetail({ slug }: { slug: ResidenceSlug }) {
  const priceFor = useResidencePrice()
  const offer = useOffer(slug)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [investmentRanks, setInvestmentRanks] = useState<InvestmentPlan[]>([])
  const [myInvestments, setMyInvestments] = useState<InvestmentRequest[]>([])
  const [investAmount, setInvestAmount] = useState('')
  const [investState, setInvestState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [investError, setInvestError] = useState<string | null>(null)
  const [investRank, setInvestRank] = useState('level-1')

  useEffect(() => {
    const client = requireSupabase()
    let active = true
    client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) console.error('Could not check member session:', error.message)
      setUserId(data.session?.user.id ?? null)
      setIsAuthenticated(Boolean(data.session?.user))
      setIsLoading(false)
    }).catch((error) => {
      if (!active) return
      console.error('Could not check member session:', error)
      setIsLoading(false)
    })
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null)
      setIsAuthenticated(Boolean(session?.user))
      setIsLoading(false)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let active = true
    const client = requireSupabase()
    client.from('membership_plans')
      .select('code,name,minimum_amount,profit_percent,commission_percent')
      .eq('active', true)
      .order('level', { ascending: true })
      .then(({ data, error }) => {
        if (!active) return
        if (error) console.error('Could not load membership plans:', error.message)
        else setInvestmentRanks((data ?? []) as InvestmentPlan[])
      })
    if (userId) {
      client.from('investment_requests')
        .select('id,property_name,amount,status')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
          if (!active) return
          if (error) console.error('Could not load investment requests:', error.message)
          else setMyInvestments((data ?? []) as InvestmentRequest[])
        })
    } else {
      setMyInvestments([])
    }
    return () => { active = false }
  }, [userId])
  const selectedRank = investmentRanks.find((rank) => rank.code === investRank) ?? investmentRanks[0] ?? null
  const investValue = Number(investAmount)
  const residence = RESIDENCES.find((item) => item.slug === slug)
  if (!residence) return null

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main id="main" className="mx-auto w-full max-w-7xl px-5 py-20 text-sm text-ink-soft sm:px-8">
          Checking your session…
        </main>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main id="main">
          <ListingsGate
            title="This residence is reserved for members."
            intro="Sign in to open the full residence page with prices, floor plans, gallery and payment options."
          />
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <section className="relative isolate flex min-h-[72svh] items-end overflow-hidden bg-deep pb-14 pt-36 text-on-deep sm:pb-16">
          <img
            src={residence.image}
            alt={residence.alt}
            className="absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div aria-hidden="true" className="hero-veil absolute inset-0 -z-10" />
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <nav aria-label="Breadcrumb" className="eyebrow text-[0.5rem] text-on-deep/70">
              <Link to="/residences" className="hover:text-brass-soft">
                Residences
              </Link>
              <span aria-hidden="true" className="px-2">/</span>
              <span className="text-brass-soft">{residence.name}</span>
            </nav>
            <h1 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.2vw,4rem)]">{residence.name}</h1>
            <p className="eyebrow mt-4 text-[0.6rem] text-brass-soft">{residence.area}</p>
            <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-on-deep/80">{residence.summary}</p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <a
                href="#gallery"
                className="eyebrow inline-flex items-center justify-between gap-8 bg-on-deep px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass"
              >
                View gallery
                <ArrowRight />
              </a>
              <a
                href="#floor-plans"
                className="eyebrow inline-flex items-center justify-between gap-8 border border-on-deep/40 px-6 py-4 text-[0.6rem] text-on-deep transition-colors hover:border-brass hover:text-brass-soft"
              >
                Floor plans
                <ArrowRight />
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-border bg-background">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {[
              { label: 'Price', value: priceFor(residence.slug, residence.price) },
              { label: 'Bedrooms', value: residence.bedrooms },
              { label: 'Size', value: residence.size },
              { label: 'Handover', value: residence.handover },
            ].map((item) => (
              <div key={item.label}>
                <p className="eyebrow text-[0.5rem] text-ink-soft">{item.label}</p>
                <p className="display mt-2 text-lg">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-b border-border bg-bone/40">
          <div className="mx-auto w-full max-w-7xl px-5 py-8 sm:px-8">
            <div className="mt-8 border-t border-border pt-6 lg:flex lg:items-end lg:justify-between lg:gap-8">
              <div className="lg:max-w-md">
                <p className="eyebrow text-[0.5rem] text-brass">Start investing</p>
                <h3 className="display mt-2 text-lg">Request an investment amount</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  Administration reviews every request before funds are added to your wallet. You
                  are notified here once it is approved and paid in.
                </p>

                {myInvestments && myInvestments.length > 0 ? (
                  <ul data-testid="invest-requests" className="mt-4 space-y-2 text-sm">
                    {myInvestments.map((row) => (
                      <li
                        key={row.id}
                        data-testid={`invest-request-${row.id}`}
                        className="flex flex-wrap items-baseline justify-between gap-2 border border-border bg-background px-3 py-2"
                      >
                        <span>
                          {row.property_name} · AED {Number(row.amount).toLocaleString()}
                        </span>
                        <span className="eyebrow text-[0.45rem] text-brass">
                          {row.status === 'funded'
                            ? 'Paid to wallet'
                            : row.status === 'approved'
                              ? 'Approved · awaiting payment'
                              : row.status === 'pending'
                                ? 'Waiting for approval'
                                : 'Not approved'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}


                {selectedRank ? (
                  <p data-testid="invest-preview" className="mt-3 text-xs text-ink-soft">
                    {selectedRank.name}: profit {selectedRank.profit_percent}% and commission{' '}
                    {selectedRank.commission_percent}% are paid into the wallet when administration
                    funds the investment.
                    {investValue >= Number(selectedRank.minimum_amount)
                      ? ` Estimated profit AED ${Math.round((investValue * selectedRank.profit_percent) / 100).toLocaleString()} and commission AED ${Math.round((investValue * selectedRank.commission_percent) / 100).toLocaleString()}.`
                      : ` Minimum AED ${Number(selectedRank.minimum_amount).toLocaleString()}.`}
                  </p>
                ) : null}
              </div>

              <form
                className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end lg:mt-0"
                onSubmit={async (event) => {
                  event.preventDefault()
                  setInvestError(null)
                  setInvestState('sending')
                  try {
                    if (!userId) throw new Error('Please sign in again to submit your investment request.')
                    if (!selectedRank || Number(investAmount) < Number(selectedRank.minimum_amount)) {
                      throw new Error('Please choose an active investment level and enter its minimum amount.')
                    }
                    const { error } = await requireSupabase().from('investment_requests').insert({
                      user_id: userId,
                      property_name: residence.name,
                      plan_code: selectedRank.code,
                      amount: Number(investAmount),
                      expected_profit: Number(investAmount) * Number(selectedRank.profit_percent) / 100,
                      expected_commission: Number(investAmount) * Number(selectedRank.commission_percent) / 100,
                      status: 'pending',
                    })
                    if (error) throw error
                    setMyInvestments((rows) => [{
                      id: crypto.randomUUID(),
                      property_name: residence.name,
                      amount: Number(investAmount),
                      status: 'pending',
                    }, ...rows])
                    setInvestAmount('')
                    setInvestState('sent')
                  } catch (err) {
                    setInvestError(
                      err instanceof Error ? err.message : 'Could not send your request',
                    )
                    setInvestState('error')
                  }
                }}
              >
                <label className="block">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Investment level</span>
                  <select
                    value={investRank}
                    onChange={(event) => setInvestRank(event.target.value)}
                    data-testid="invest-rank"
                    className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none focus:border-brass sm:w-52"
                  >
                    {(investmentRanks ?? []).map((rank) => (
                      <option key={rank.code} value={rank.code}>
                        {rank.name} · from AED {Number(rank.minimum_amount).toLocaleString()}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="eyebrow text-[0.5rem] text-ink-soft">Amount in AED</span>
                  <input
                    type="number"
                    min={selectedRank ? Number(selectedRank.minimum_amount) : 50000}
                    step={1000}
                    required
                    value={investAmount}
                    onChange={(event) => setInvestAmount(event.target.value)}
                    placeholder="50000"
                    data-testid="invest-amount"
                    className="mt-2 w-full border border-input bg-background px-4 py-3 text-[0.95rem] outline-none focus:border-brass sm:w-44"
                  />
                </label>
                <button
                  type="submit"
                  disabled={investState === 'sending'}
                  data-testid="invest-submit"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-ink px-6 py-4 text-[0.6rem] text-ink transition-colors hover:bg-ink hover:text-background disabled:opacity-60"
                >
                  {investState === 'sending' ? 'Sending…' : 'Request approval'}
                  <ArrowRight />
                </button>
              </form>
            </div>

            <p
              data-testid="invest-status"
              data-state={investState}
              className={`mt-3 text-sm ${investError ? 'text-destructive' : 'text-ink-soft'}`}
            >
              {investError
                ? investError
                : investState === 'sent'
                  ? 'Request sent. Administration reviews it before funds reach your wallet.'
                  : ''}
            </p>
          </div>
        </section>

        {offer ? (
          <section className="border-b border-border bg-brass/10">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div>
                <p className="eyebrow text-[0.5rem] text-brass">Current offer</p>
                <p data-testid="residence-offer" className="display mt-2 text-xl">
                  {offer.title}
                </p>
              </div>
              {offer.detail ? (
                <p className="max-w-md text-sm leading-relaxed text-ink-soft">{offer.detail}</p>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-7">
              <p className="eyebrow text-brass">The address</p>
              <h2 className="display mt-5 text-[clamp(1.8rem,3vw,2.6rem)]">{residence.configuration}</h2>
              <p className="mt-6 text-[1.02rem] leading-relaxed text-ink-soft">{residence.description}</p>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={120}>
              <div className="border border-border bg-bone/40 p-6 sm:p-8">
                <p className="eyebrow text-[0.5rem] text-ink-soft">Residence features</p>
                <ul className="mt-5 space-y-4">
                  {residence.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-[0.95rem] text-ink-soft">
                      <span aria-hidden="true" className="mt-2 h-px w-6 shrink-0 bg-brass" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="#enquire"
                  className="eyebrow mt-8 inline-flex w-full items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
                >
                  Arrange a viewing
                  <ArrowRight />
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="gallery" className="scroll-mt-24 bg-bone/50 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-brass">Gallery</p>
                <h2 className="display mt-4 text-[clamp(1.8rem,3vw,2.6rem)]">{residence.name} in detail</h2>
              </div>
              <p className="max-w-xs text-sm leading-relaxed text-ink-soft">
                Photography and renders of the finished specification.
              </p>
            </Reveal>

            <div
              data-testid="residence-gallery"
              data-state="ready"
              className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4"
            >
              {residence.gallery.map((shot, index) => (
                <Reveal
                  key={`${shot.src}-${index}`}
                  delay={index * 60}
                  className={index === 0 ? 'col-span-2 row-span-2 lg:col-span-2' : ''}
                >
                  <figure className="group relative h-full overflow-hidden bg-deep">
                    <img
                      src={shot.src}
                      alt={shot.caption}
                      className={[
                        'w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]',
                        index === 0 ? 'aspect-[4/3] lg:aspect-auto lg:h-full' : 'aspect-[4/3]',
                      ].join(' ')}
                      loading="lazy"
                    />
                    <figcaption className="absolute inset-x-0 bottom-0 bg-deep/70 px-4 py-3 text-[0.7rem] tracking-wide text-on-deep backdrop-blur-sm">
                      {shot.caption}
                    </figcaption>
                  </figure>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="floor-plans" className="scroll-mt-24 py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <Reveal>
              <p className="eyebrow text-brass">Floor plans</p>
              <h2 className="display mt-4 text-[clamp(1.8rem,3vw,2.6rem)]">Every layout, drawn to scale</h2>
              <p className="mt-4 max-w-xl text-[0.98rem] leading-relaxed text-ink-soft">
                Choose a layout to compare the room arrangement and internal area.
              </p>
            </Reveal>

            <div className="mt-8">
              <FloorPlanSection plans={residence.plans} />
            </div>
          </div>
        </section>

        <section id="investment" className="scroll-mt-24 bg-deep py-16 text-on-deep sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <p className="eyebrow text-brass-soft">Investment</p>
              <h2 className="display mt-4 text-[clamp(1.8rem,3vw,2.6rem)]">Price and payment options</h2>
              <dl className="mt-8 space-y-5 border-t border-on-deep/15 pt-6">
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="eyebrow text-[0.5rem] text-on-deep-soft">Entry price</dt>
                  <dd className="display text-xl">{priceFor(residence.slug, residence.investment.entryFrom)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="eyebrow text-[0.5rem] text-on-deep-soft">Indicative yield</dt>
                  <dd className="display text-xl">{residence.investment.yieldPct} net</dd>
                </div>
                <div className="flex items-baseline justify-between gap-6">
                  <dt className="eyebrow text-[0.5rem] text-on-deep-soft">Wallet</dt>
                  <dd className="display text-xl">AED</dd>
                </div>
              </dl>
              <p className="mt-6 text-xs leading-relaxed text-on-deep/55">{residence.investment.note}</p>
              <div className="mt-8 flex flex-col gap-3">
                <Link
                  to="/wallet"
                  className="eyebrow inline-flex items-center justify-between gap-8 bg-on-deep px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass"
                >
                  Open investment wallet
                  <ArrowRight />
                </Link>
                <Link
                  to="/membership"
                  className="eyebrow inline-flex items-center justify-between gap-8 border border-on-deep/35 px-6 py-4 text-[0.6rem] text-on-deep transition-colors hover:border-brass hover:text-brass-soft"
                >
                  Membership levels
                  <ArrowRight />
                </Link>
              </div>
            </Reveal>

            <div className="lg:col-span-7">
              <ul className="border-t border-on-deep/15">
                {residence.investment.options.map((option, index) => (
                  <Reveal
                    key={option.name}
                    delay={index * 70}
                    className="grid gap-2 border-b border-on-deep/15 py-6 sm:grid-cols-12 sm:gap-6"
                  >
                    <span className="eyebrow text-[0.55rem] text-brass sm:col-span-4">{option.name}</span>
                    <span className="text-sm leading-relaxed text-on-deep/70 sm:col-span-8">{option.detail}</span>
                  </Reveal>
                ))}
              </ul>
              <p className="mt-6 text-xs leading-relaxed text-on-deep/50">
                Payment plans are subject to approval and are confirmed in writing by the sales
                gallery. Wallet balances are held in AED and released on administration approval.
              </p>
            </div>
          </div>
        </section>

        <section id="enquire" className="scroll-mt-24 bg-bone/60 py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-5">
              <p className="eyebrow text-brass">Private preview</p>
              <h2 className="display mt-5 text-[clamp(1.8rem,3vw,2.6rem)]">See it in person.</h2>
              <p className="mt-6 text-[1.02rem] leading-relaxed text-ink-soft">
                Viewings at {residence.name} run daily by appointment. Leave your details and the
                residential team will confirm a time with you.
              </p>
              <Link to="/residences" className="eyebrow link-underline mt-8 text-[0.58rem]">
                Back to all residences
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
            <Reveal className="lg:col-span-7" delay={120}>
              <EnquiryForm residence={residence.name} source={`residence:${residence.slug}`} />
            </Reveal>
          </div>
        </section>

        <section className="bg-background py-16">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <h2 className="display text-2xl">Other addresses</h2>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2">
              {RESIDENCES.filter((item) => item.slug !== residence.slug).map((item) => (
                <li key={item.slug} className="group border border-border bg-card">
                  <Link to={RESIDENCE_PATHS[item.slug]} className="flex items-center gap-5 p-4">
                    <img src={item.image} alt={item.alt} className="h-20 w-24 shrink-0 object-cover" loading="lazy" />
                    <span>
                      <span className="display block text-lg">{item.name}</span>
                      <span className="eyebrow mt-1 block text-[0.5rem] text-brass">{item.area}</span>
                    </span>
                    <ArrowRight className="ml-auto h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
