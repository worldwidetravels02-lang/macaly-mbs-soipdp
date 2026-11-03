import { createFileRoute, Link } from '@tanstack/react-router'
import { AuthLoading, Authenticated, Unauthenticated } from 'convex/react'
import { ListingsGate } from '../components/listings-gate'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES, RESIDENCES, RESIDENCE_PATHS } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import { useResidencePrice } from '../lib/prices'
import { useActiveOffers } from '../lib/offers'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/residences']

export const Route = createFileRoute('/residences/')({
  head: () => {
    const canonical = canonicalUrl('/residences')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: ResidencesPage,
})

function ResidencesPage() {
  const priceFor = useResidencePrice()
  const offerFor = useActiveOffers()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="The collection"
          title="Twenty addresses, one standard."
          intro="Every Msheireb residence is released in limited numbers, with private previews by appointment. Filter nothing out: each address is finished to the same specification."
          image={IMAGES.tower}
          imageAlt="Msheireb Properties tower at dusk"
        />

        <AuthLoading>
          <p className="mx-auto w-full max-w-7xl px-5 py-16 text-sm text-ink-soft sm:px-8">
            Checking your session…
          </p>
        </AuthLoading>

        <Unauthenticated>
          <ListingsGate />
        </Unauthenticated>

        <Authenticated>
        <section className="py-16 sm:py-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <ul className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
              {RESIDENCES.map((residence, index) => (
                <Reveal key={residence.slug} delay={index * 100}>
                  <li
                    data-testid={`residence-${residence.slug}`}
                    className="group flex h-full flex-col border border-border bg-card"
                  >
                    <div className="relative overflow-hidden">
                      <img
                        src={residence.image}
                        alt={residence.alt}
                        className="aspect-[4/3] w-full object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04]"
                        loading="lazy"
                      />
                      <span className="eyebrow absolute left-4 top-4 bg-deep/85 px-3 py-1.5 text-[0.5rem] text-on-deep backdrop-blur">
                        {priceFor(residence.slug, residence.price)}
                      </span>
                      {offerFor(residence.slug) ? (
                        <span
                          data-testid={`residence-offer-${residence.slug}`}
                          className="eyebrow absolute right-4 top-4 max-w-[70%] bg-brass px-3 py-1.5 text-[0.45rem] leading-tight text-deep"
                        >
                          {offerFor(residence.slug)}
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="display text-2xl">{residence.name}</h2>
                      <p className="eyebrow mt-2 text-[0.52rem] text-brass">{residence.area}</p>
                      <p className="mt-4 text-sm text-ink-soft">{residence.configuration}</p>
                      <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm text-ink-soft">
                        <div className="flex justify-between gap-4">
                          <dt>Size</dt>
                          <dd>{residence.size}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt>Handover</dt>
                          <dd>{residence.handover}</dd>
                        </div>
                      </dl>
                      <Link
                        to={RESIDENCE_PATHS[residence.slug]}
                        data-testid={`residence-view-${residence.slug}`}
                        className="eyebrow link-underline mt-auto pt-6 text-[0.58rem] text-ink"
                      >
                        View residence
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </li>
                </Reveal>
              ))}
            </ul>

            <Reveal className="mt-16 flex flex-col gap-6 border-t border-border pt-10 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-md text-[0.98rem] leading-relaxed text-ink-soft">
                Brochures, floor plans and payment plans are shared during a private appointment.
              </p>
              <Link
                to="/contact"
                className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
              >
                Book a private preview
                <ArrowRight />
              </Link>
            </Reveal>
          </div>
        </section>
        </Authenticated>
      </main>
      <SiteFooter />
    </div>
  )
}
