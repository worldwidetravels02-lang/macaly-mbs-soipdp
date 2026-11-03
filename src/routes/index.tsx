import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { ListingsGate } from '../components/listings-gate'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { AMENITIES, IMAGES, RESIDENCES, RESIDENCE_PATHS, SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const homepageMeta = siteMetadata['/']

export const Route = createFileRoute('/')({
  head: () => {
    const canonical = canonicalUrl('/')

    return {
      meta: [
        { title: homepageMeta.title },
        { name: 'description', content: homepageMeta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: HomePage,
})

function HomePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader overlay />
      <main id="main">
        <Hero />
        <Residential />
        <Collection />
        <Amenities />
        <Legacy />
        <DesignNotes />
        <ResidentReviews />
        <MemberPortal />
        <ContactCta />
      </main>
      <SiteFooter />
    </div>
  )
}

function Hero() {
  return (
    <section className="relative isolate flex min-h-[100svh] flex-col justify-end overflow-hidden bg-deep">
      <img
        src={IMAGES.tower}
        alt="Illustrative luxury residential concept image"
        className="absolute inset-0 -z-10 h-full w-full object-cover"
        loading="eager"
      />
      <div aria-hidden="true" className="hero-veil absolute inset-0 -z-10" />

      <div className="mx-auto w-full max-w-7xl px-5 pb-14 pt-36 sm:px-8 sm:pb-16 sm:pt-40">
        <p className="eyebrow rise text-brass-soft" style={{ animationDelay: '80ms' }}>
          {SITE.city} · Luxury residential
        </p>

        <h1
          className="display rise mt-6 max-w-4xl text-[clamp(2.7rem,7.4vw,5.9rem)] text-on-deep"
          style={{ animationDelay: '180ms' }}
        >
          Redefining
          <span className="block italic text-brass-soft">urban living.</span>
        </h1>

        <p
          className="rise mt-8 max-w-xl text-[1.02rem] leading-relaxed text-on-deep/80 sm:text-lg"
          style={{ animationDelay: '300ms' }}
        >
          Explore a curated presentation of luxury homes in {SITE.city}. This preview uses sample listings while verified project information is being prepared.
        </p>

        <div
          className="rise mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4"
          style={{ animationDelay: '420ms' }}
        >
          <Link
            to="/residences"
            data-testid="hero-explore"
            className="eyebrow group inline-flex items-center justify-between gap-8 bg-on-deep px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass"
          >
            Explore residences
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
          <Link
            to="/login"
            data-testid="hero-login"
            className="eyebrow group inline-flex items-center justify-between gap-8 border border-on-deep/40 px-6 py-4 text-[0.6rem] text-on-deep transition-colors hover:border-brass hover:text-brass-soft"
          >
            <span className="cta-sheen inline-flex items-center gap-8">
              Member login
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Link>
          <Link
            to="/register"
            data-testid="hero-signup"
            className="eyebrow group inline-flex items-center justify-between gap-8 bg-brass px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass-soft"
          >
            <span className="cta-sheen inline-flex items-center gap-8">
              Create account
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </Link>
        </div>

        <dl
          className="rise mt-14 grid grid-cols-1 gap-6 border-t border-on-deep/15 pt-8 sm:grid-cols-3 sm:gap-8"
          style={{ animationDelay: '560ms' }}
        >
          {[
            { value: 'Sample', label: 'Property collection' },
            { value: 'Dubai', label: 'Initial market' },
            { value: 'Preview', label: 'Website demonstration' },
          ].map((stat) => (
            <div key={stat.label}>
              <dt className="eyebrow text-[0.55rem] text-on-deep-soft">{stat.label}</dt>
              <dd className="display mt-2 text-3xl text-on-deep sm:text-4xl">{stat.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

function Residential() {
  return (
    <section id="residential" className="relative bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow text-brass">Residential</p>
          <h2 className="display mt-5 text-[clamp(2rem,3.6vw,3.2rem)]">
            Built on a legacy of elegance, style and lifestyle.
          </h2>
          <p className="mt-6 text-[1.02rem] leading-relaxed text-ink-soft">
            Browse the sample property presentation. Project specifications, availability, amenities and ownership details will be added after verification.
          </p>

          <ul className="mt-8 space-y-4 border-t border-border pt-8">
            {[
              'Illustrative property presentation',
              'Sample layouts and concept imagery',
              'Verified project details to be added',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-[0.98rem] text-ink-soft">
                <span aria-hidden="true" className="mt-2 h-px w-6 shrink-0 bg-brass" />
                {item}
              </li>
            ))}
          </ul>

          <Link to="/residences" className="eyebrow link-underline mt-9 text-[0.6rem] text-ink">
            View all residences
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>

        <Reveal className="lg:col-span-7" delay={120}>
          <div className="relative">
            <div aria-hidden="true" className="absolute -left-4 -top-4 hidden h-full w-full border border-brass/40 sm:block" />
            <img
              src={IMAGES.living}
              alt="Illustrative luxury residential interior concept image"
              className="relative aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="relative -mt-10 ml-0 w-[min(19rem,88%)] border border-border bg-card px-6 py-5 soft-shadow sm:ml-8">
              <p className="eyebrow text-[0.55rem] text-brass">Now previewing</p>
              <p className="display mt-2 text-xl">Sample residence</p>
              <p className="mt-1 text-sm text-ink-soft">Dubai, UAE · sample location</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}

function Collection() {

  return (
    <section id="residences" className="bg-bone/60 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">The collection</p>
            <h2 className="display mt-5 max-w-xl text-[clamp(2rem,3.6vw,3.2rem)]">
              A preview of the collection.
            </h2>
          </div>
          <p className="max-w-sm text-[0.98rem] leading-relaxed text-ink-soft">
            The listings below are demonstration content. Names, images and specifications are placeholders, not confirmed projects or offers.
          </p>
        </Reveal>

<Authenticated>
        <div data-testid="home-collection" className="mt-14 grid gap-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {RESIDENCES.slice(0, 4).map((residence, index) => (
            <Reveal key={residence.slug} delay={index * 110}>
              <article
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
                    {residence.price}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="display text-2xl">{residence.name}</h3>
                  <p className="eyebrow mt-2 text-[0.52rem] text-brass">{residence.area}</p>
                  <p className="mt-4 text-sm text-ink-soft">{residence.configuration}</p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-soft">{residence.summary}</p>

                  <Link
                    to={RESIDENCE_PATHS[residence.slug]}
                    data-testid={`residence-view-${residence.slug}`}
                    className="eyebrow link-underline mt-auto pt-6 text-[0.58rem] text-ink"
                  >
                    View residence
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

function Amenities() {
  return (
    <section id="amenities" className="relative overflow-hidden bg-deep py-20 text-on-deep sm:py-28 lg:py-32">
      <div className="mx-auto grid w-full max-w-7xl gap-14 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow text-brass-soft">Amenities</p>
          <h2 className="display mt-5 text-[clamp(2rem,3.6vw,3.2rem)]">
            The club is the quiet centre of the address.
          </h2>
          <p className="mt-6 text-[1.02rem] leading-relaxed text-on-deep/70">
            Amenities shown here are illustrative examples only. Actual facilities will depend on each verified development.
          </p>

          <div className="relative mt-10">
            <img
              src={IMAGES.pool}
              alt="Illustrative residential amenity concept image"
              className="aspect-[4/3] w-full object-cover"
              loading="lazy"
            />
            <div className="image-veil absolute inset-x-0 bottom-0 px-5 pb-4 pt-14">
              <p className="eyebrow text-[0.5rem] text-brass-soft">Illustrative amenity</p>
              <p className="display mt-1 text-lg">Hours to be confirmed</p>
            </div>
          </div>
        </Reveal>

        <div className="lg:col-span-7">
          <ul className="border-t border-on-deep/15">
            {AMENITIES.map((amenity, index) => (
              <li key={amenity.index}>
                <Reveal
                  delay={index * 70}
                  className="group flex gap-5 border-b border-on-deep/15 py-6 transition-colors hover:border-brass/60 sm:gap-8"
                >
                  <span className="eyebrow w-8 shrink-0 pt-1 text-[0.55rem] text-brass">{amenity.index}</span>
                  <div>
                    <h3 className="display text-xl text-on-deep transition-colors group-hover:text-brass-soft sm:text-2xl">
                      {amenity.title}
                    </h3>
                    <p className="mt-2 max-w-md text-sm leading-relaxed text-on-deep/65">{amenity.detail}</p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>

          <Reveal delay={120}>
            <Link to="/amenities" className="eyebrow link-underline mt-10 text-[0.6rem] text-on-deep">
              Explore all amenities
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

function Legacy() {
  return (
    <section id="legacy" className="bg-background py-20 sm:py-28 lg:py-32">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
        <Reveal className="lg:col-span-5">
          <img
            src={IMAGES.detail}
            alt="Travertine wall with bronze fins and a palm shadow in afternoon light"
            className="aspect-[3/4] w-full object-cover"
            loading="lazy"
          />
        </Reveal>

        <Reveal className="lg:col-span-6 lg:col-start-7" delay={120}>
          <p className="eyebrow text-brass">Legacy</p>
          <h2 className="display mt-5 text-[clamp(2rem,3.6vw,3.2rem)]">Detail is the whole argument.</h2>
          <p className="mt-6 text-[1.02rem] leading-relaxed text-ink-soft">
            This section is a design placeholder for the company profile. Add the verified company history, completed developments and design credentials before launch.
          </p>

          <blockquote className="mt-10 border-l border-brass/60 pl-6">
            <p className="display text-[clamp(1.4rem,2.2vw,1.9rem)] italic leading-snug">
              “A considered home begins with a clear understanding of place, light and the way people live.”
            </p>
            <footer className="eyebrow mt-4 text-[0.52rem] text-ink-soft">
              Sample brand statement
            </footer>
          </blockquote>

          <dl className="mt-10 grid grid-cols-2 gap-6 border-t border-border pt-8 sm:grid-cols-3">
            {[
              { value: 'To be confirmed', label: 'Company history' },
              { value: 'To be confirmed', label: 'Awards and credentials' },
              { value: 'To be confirmed', label: 'Completed residences' },
            ].map((stat) => (
              <div key={stat.label}>
                <dt className="eyebrow text-[0.5rem] text-ink-soft">{stat.label}</dt>
                <dd className="display mt-2 text-2xl">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <Link to="/about" className="eyebrow link-underline mt-10 text-[0.6rem] text-ink">
            Our story
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}

type DesignPhoto = {
  src: string
  alt: string
  caption: string
  frame: string
}

function Lightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: DesignPhoto[]
  index: number
  onClose: () => void
  onNavigate: (direction: number) => void
}) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const photo = photos[index]

  useEffect(() => {
    closeRef.current?.focus()
  }, [index])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === 'ArrowRight') {
        onNavigate(1)
        return
      }
      if (event.key === 'ArrowLeft') {
        onNavigate(-1)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, onNavigate])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${photo.caption}. Image ${index + 1} of ${photos.length}`}
      data-testid="lightbox"
      className="fixed inset-0 z-[80] flex flex-col bg-deep/95 text-on-deep backdrop-blur-sm"
    >
      <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <p className="eyebrow text-[0.45rem] text-on-deep/60">
          {String(index + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
        </p>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          data-testid="lightbox-close"
          className="eyebrow flex items-center gap-3 border border-on-deep/25 px-4 py-2.5 text-[0.45rem] transition-colors hover:border-brass hover:text-brass-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-soft"
        >
          Close
          <span aria-hidden="true" className="text-base leading-none">
            ×
          </span>
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-5 pb-4 sm:px-8">
        <img
          src={photo.src}
          alt={photo.alt}
          data-testid="lightbox-image"
          className="max-h-full max-w-full object-contain shadow-2xl"
        />
      </div>

      <div className="flex items-center justify-between gap-6 px-5 pb-6 pt-2 sm:px-8 sm:pb-8">
        <p data-testid="lightbox-caption" className="eyebrow text-[0.45rem] text-on-deep/70">
          {photo.caption}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onNavigate(-1)}
            data-testid="lightbox-prev"
            aria-label="Previous image"
            className="border border-on-deep/25 px-4 py-2.5 text-sm transition-colors hover:border-brass hover:text-brass-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-soft"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate(1)}
            data-testid="lightbox-next"
            aria-label="Next image"
            className="border border-on-deep/25 px-4 py-2.5 text-sm transition-colors hover:border-brass hover:text-brass-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass-soft"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </div>
  )
}

function DesignNotes() {
  const notes = [
    {
      title: 'Material',
      body: 'Example material palette for concept imagery only.',
    },
    {
      title: 'Light',
      body: 'Example design consideration. Actual dimensions and specifications are to be confirmed.',
    },
    {
      title: 'Proportion',
      body: 'Example planning principle. Actual layouts and dimensions are to be confirmed.',
    },
  ]

  const photos: DesignPhoto[] = [
    {
      src: IMAGES.villas,
      alt: 'Beachfront villas with private infinity pools and palm groves at dusk',
      caption: 'Illustrative residential concept',
      frame: 'aspect-[4/3]',
    },
    {
      src: IMAGES.lowrise,
      alt: 'Limestone low-rise facades with planted terraces and shade screens',
      caption: 'Illustrative exterior concept',
      frame: 'aspect-[16/10]',
    },
    {
      src: IMAGES.bath,
      alt: 'Travertine bathroom with a walnut vanity, brass tapware and palm shadows on the wall',
      caption: 'Illustrative interior concept',
      frame: 'aspect-[3/2]',
    },
    {
      src: IMAGES.rooftop,
      alt: 'Rooftop terrace with a lap pool, linen seating and the Dubai skyline at dusk',
      caption: 'Illustrative rooftop concept',
      frame: 'aspect-[3/2]',
    },
  ]

  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const closeLightbox = useCallback(() => setOpenIndex(null), [])
  const navigateLightbox = useCallback(
    (direction: number) =>
      setOpenIndex((current) =>
        current === null ? current : (current + direction + photos.length) % photos.length,
      ),
    [photos.length],
  )

  const photoButton = (photo: DesignPhoto, index: number) => (
    <button
      type="button"
      onClick={() => setOpenIndex(index)}
      data-testid={`design-photo-${index}`}
      aria-label={`View full screen: ${photo.caption}`}
      className="group block w-full cursor-zoom-in text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brass"
    >
      <div className="overflow-hidden">
        <img
          src={photo.src}
          alt={photo.alt}
          className={`${photo.frame} w-full object-cover transition-transform duration-[1200ms] group-hover:scale-[1.03]`}
          loading="lazy"
        />
      </div>
      <span className="eyebrow mt-4 flex items-center gap-2 text-[0.45rem] text-ink-soft transition-colors group-hover:text-brass">
        {photo.caption}
        <span aria-hidden="true" className="text-[0.7rem] leading-none">
          +
        </span>
      </span>
    </button>
  )

  return (
    <section id="design" className="scroll-mt-24 bg-bone/60 py-20 sm:py-28 lg:py-32">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">Design preview</p>
            <h2 className="display mt-4 max-w-xl text-[clamp(1.9rem,3.4vw,3rem)]">
              A considered approach to residential design.
            </h2>
          </div>
          <p className="max-w-sm text-[0.95rem] leading-relaxed text-ink-soft">
            These notes and images are illustrative design concepts, not verified specifications for a completed project.
          </p>
        </Reveal>

        <div data-testid="home-design" className="mt-12 grid gap-6 lg:grid-cols-12 lg:gap-8">
          <Reveal className="lg:col-span-7">
            <figure className="h-full">{photoButton(photos[0], 0)}</figure>
          </Reveal>

          <div className="grid gap-6 lg:col-span-5">
            <Reveal delay={100}>
              <figure>{photoButton(photos[1], 1)}</figure>
            </Reveal>

            <Reveal delay={180}>
              <ol className="border border-border bg-background p-6 sm:p-7">
                {notes.map((note, index) => (
                  <li
                    key={note.title}
                    className="flex gap-4 border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0"
                  >
                    <span className="eyebrow pt-1 text-[0.45rem] text-brass">0{index + 1}</span>
                    <div>
                      <p className="display text-base">{note.title}</p>
                      <p className="mt-1 text-[0.9rem] leading-relaxed text-ink-soft">{note.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Reveal>
          </div>

          <Reveal className="lg:col-span-6" delay={60}>
            <figure>{photoButton(photos[2], 2)}</figure>
          </Reveal>

          <Reveal className="lg:col-span-6" delay={140}>
            <figure>{photoButton(photos[3], 3)}</figure>
          </Reveal>
        </div>
      </div>

      {openIndex !== null ? (
        <Lightbox
          photos={photos}
          index={openIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      ) : null}
    </section>
  )
}

function ResidentReviews() {
  const reviews: { quote: string; name: string; detail: string }[] = []

  return (
    <section id="reviews" className="scroll-mt-24 bg-background py-16 sm:py-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <Reveal className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow text-brass">Resident voices</p>
            <h2 className="display mt-4 max-w-lg text-[clamp(1.8rem,3.2vw,2.8rem)]">
              Resident stories
            </h2>
          </div>
          <p className="eyebrow text-[0.5rem] text-ink-soft">Verified testimonials will appear here</p>
        </Reveal>

        <ul data-testid="home-reviews" className="tilt-scene mt-10 grid gap-5 md:grid-cols-3">
          {reviews.map((review, index) => (
            <li key={review.name}>
              <Reveal delay={index * 90}>
                <figure
                  className="tilt-card tilt-float h-full border border-border bg-card p-6"
                  style={{ animationDelay: `${index * 900}ms` }}
                >
                  <span aria-hidden="true" className="display text-3xl leading-none text-brass/70">
                    &ldquo;
                  </span>
                  <blockquote className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft">
                    {review.quote}
                  </blockquote>
                  <figcaption className="mt-5 border-t border-border pt-4">
                    <p className="display text-base">{review.name}</p>
                    <p className="eyebrow mt-1 text-[0.45rem] text-brass">{review.detail}</p>
                  </figcaption>
                </figure>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function MemberPortal() {
  return (
    <section className="bg-bone/60 py-16 sm:py-20">
      <Reveal className="mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="relative overflow-hidden bg-deep px-6 py-12 text-on-deep sm:px-12 sm:py-16">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full border border-brass/30" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-24 h-64 w-64 rounded-full border border-brass/15" />

          <div className="relative grid gap-10 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="eyebrow text-brass-soft">Member portal</p>
              <h2 className="display mt-5 text-[clamp(1.9rem,3.4vw,3rem)]">
                Your residence, your documents, your concierge.
              </h2>
              <p className="mt-5 max-w-lg text-[1rem] leading-relaxed text-on-deep/70">
                Owners and applicants can register with their email and mobile number to track
                bookings, download allotment papers and raise service requests.
              </p>
            </div>

            <div className="flex flex-col gap-3 lg:col-span-5 lg:items-end">
              <Link
                to="/login"
                data-testid="portal-login"
                className="eyebrow flex w-full items-center justify-between gap-8 bg-on-deep px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass lg:max-w-xs"
              >
                Login
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/register"
                data-testid="portal-signup"
                className="eyebrow flex w-full items-center justify-between gap-8 border border-on-deep/35 px-6 py-4 text-[0.6rem] text-on-deep transition-colors hover:border-brass hover:text-brass-soft lg:max-w-xs"
              >
                Create an account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  )
}

function ContactCta() {
  return (
    <section className="bg-background py-20 sm:py-24">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:items-end">
        <Reveal className="lg:col-span-7">
          <p className="eyebrow text-brass">Contact</p>
          <h2 className="display mt-5 text-[clamp(2rem,3.6vw,3.2rem)]">Book a private preview.</h2>
          <p className="mt-6 max-w-lg text-[1.02rem] leading-relaxed text-ink-soft">
            Contact information and viewing arrangements will be published once confirmed.
          </p>
        </Reveal>
        <Reveal className="lg:col-span-5" delay={120}>
          <div className="border border-border bg-card p-6 sm:p-8">
            <p className="eyebrow text-[0.5rem] text-ink-soft">Sales gallery</p>
            <p className="mt-2 text-[0.98rem]">
              {SITE.address[0]}
              <br />
              {SITE.address[1]}
            </p>
            <p className="mt-5 text-sm text-ink-soft">{SITE.hours}</p>
            <Link
              to="/contact"
              className="eyebrow mt-6 inline-flex w-full items-center justify-between gap-8 bg-primary px-6 py-4 text-[0.6rem] text-primary-foreground transition-colors hover:bg-ink/85"
            >
              Request a callback
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
