import { createFileRoute, Link } from '@tanstack/react-router'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { AMENITIES, IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/amenities']

export const Route = createFileRoute('/amenities')({
  head: () => {
    const canonical = canonicalUrl('/amenities')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AmenitiesPage,
})

const CLUB_DETAILS = [
  { title: 'Open every day', detail: 'Pool 05:30 to 22:00, club 07:00 to 23:00, spa by appointment.' },
  { title: 'For residents and guests', detail: 'Up to six guests per residence, booked through the concierge.' },
  { title: 'Staffed, not automated', detail: 'A resident team runs the club, the valet and the concierge desk.' },
]

function AmenitiesPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Amenities"
          title="The club is the quiet centre of the address."
          intro="Six levels of amenity space, designed with the same care as the residences themselves. Available to residents and their guests, every day of the year."
          image={IMAGES.pool}
          imageAlt="Indoor lap pool under a limestone colonnade"
        />

        <section className="py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-7">
              <ul className="border-t border-border">
                {AMENITIES.map((amenity, index) => (
                  <li key={amenity.index}>
                    <Reveal
                      delay={index * 70}
                      className="group flex gap-5 border-b border-border py-6 transition-colors hover:border-brass/60 sm:gap-8"
                    >
                      <span className="eyebrow w-8 shrink-0 pt-1 text-[0.55rem] text-brass">{amenity.index}</span>
                      <div>
                        <h2 className="display text-xl transition-colors group-hover:text-brass sm:text-2xl">
                          {amenity.title}
                        </h2>
                        <p className="mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{amenity.detail}</p>
                      </div>
                    </Reveal>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={120}>
              <div className="grid gap-4">
                <img
                  src={IMAGES.pool}
                  alt="Indoor lap pool with limestone arches and palms"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
                <img
                  src={IMAGES.detail}
                  alt="Travertine and bronze detail in afternoon light"
                  className="aspect-[4/3] w-full object-cover"
                  loading="lazy"
                />
              </div>

              <dl className="mt-8 space-y-5 border-t border-border pt-6">
                {CLUB_DETAILS.map((item) => (
                  <div key={item.title}>
                    <dt className="eyebrow text-[0.5rem] text-ink-soft">{item.title}</dt>
                    <dd className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        <section className="bg-bone/60 py-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p className="display max-w-md text-[clamp(1.5rem,2.6vw,2.1rem)]">
              See the club floor during your private preview.
            </p>
            <Link
              to="/contact"
              className="eyebrow inline-flex items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Book a private preview
              <ArrowRight />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
