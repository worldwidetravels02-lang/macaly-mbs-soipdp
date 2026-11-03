import { Link } from '@tanstack/react-router'
import { EnquiryForm } from './enquiry-form'
import { FloorPlanSection } from './floor-plan'
import { Reveal } from './reveal'
import { ArrowRight, SiteFooter, SiteHeader } from './site-chrome'
import { RESIDENCES, RESIDENCE_PATHS, type ResidenceSlug } from '../data/site'
import { useResidencePrice } from '../lib/prices'

/** Public residence detail page. Enquiries are stored through Supabase. */
export function ResidenceDetail({ slug }: { slug: ResidenceSlug }) {
  const priceFor = useResidencePrice()
  const residence = RESIDENCES.find((item) => item.slug === slug)

  if (!residence) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <SiteHeader />
        <main className="mx-auto max-w-4xl px-5 py-32">
          <h1 className="display text-3xl">Residence not found</h1>
          <Link to="/residences" className="eyebrow mt-6 inline-flex items-center gap-3">Browse residences <ArrowRight /></Link>
        </main>
        <SiteFooter />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <section className="relative isolate flex min-h-[65svh] items-end overflow-hidden bg-deep pb-14 pt-36 text-on-deep sm:pb-16">
          <img src={residence.image} alt={residence.alt} className="absolute inset-0 -z-10 h-full w-full object-cover" />
          <div aria-hidden="true" className="hero-veil absolute inset-0 -z-10" />
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <nav aria-label="Breadcrumb" className="eyebrow text-[0.5rem] text-on-deep/70">
              <Link to="/residences" className="hover:text-brass-soft">Residences</Link>
              <span aria-hidden="true" className="px-2">/</span>
              <span className="text-brass-soft">{residence.name}</span>
            </nav>
            <h1 className="display mt-5 max-w-3xl text-[clamp(2.2rem,5.2vw,4rem)]">{residence.name}</h1>
            <p className="eyebrow mt-4 text-[0.6rem] text-brass-soft">{residence.area}</p>
            <p className="mt-5 max-w-xl text-[1.02rem] leading-relaxed text-on-deep/80">{residence.summary}</p>
            <a href="#enquire" className="eyebrow mt-7 inline-flex items-center gap-4 bg-on-deep px-6 py-4 text-[0.6rem] text-deep">Enquire now <ArrowRight /></a>
          </div>
        </section>

        <section className="border-b border-border bg-background">
          <div className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-8 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {[
              { label: 'Price guide', value: priceFor(residence.slug, residence.price) },
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

        <section className="py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2">
            <Reveal>
              <p className="eyebrow text-brass">The residence</p>
              <h2 className="display mt-3 text-3xl">A considered place to call home.</h2>
              <p className="mt-5 text-sm leading-relaxed text-ink-soft">{residence.summary}</p>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">{residence.configuration}</p>
              <Link to="/residences" className="eyebrow mt-8 inline-flex items-center gap-3 underline decoration-brass underline-offset-4">Explore all residences <ArrowRight /></Link>
            </Reveal>
            <Reveal delay={100}>
              <img src={residence.image} alt={residence.alt} className="aspect-[4/3] w-full object-cover" loading="lazy" />
            </Reveal>
          </div>
        </section>

        <section className="border-y border-border bg-bone/40 py-14 sm:py-18">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <FloorPlanSection plans={residence.plans} />
          </div>
        </section>

        <section id="enquire" className="py-16 sm:py-20">
          <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <p className="eyebrow text-brass">Private preview</p>
              <h2 className="display mt-3 text-3xl">Discover this residence.</h2>
              <p className="mt-4 text-sm leading-relaxed text-ink-soft">Leave your details and our property team will contact you about availability, floor plans and viewing arrangements.</p>
            </div>
            <div className="lg:col-span-3">
              <EnquiryForm residence={residence.name} source={`residence-${residence.slug}`} />
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
