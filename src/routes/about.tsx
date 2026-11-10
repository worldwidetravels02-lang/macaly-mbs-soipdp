import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { requireSupabase } from '../lib/supabase-client'
import { Reveal } from '../components/reveal'
import { ArrowRight, PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES, SITE } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/about']

export const Route = createFileRoute('/about')({
  head: () => {
    const canonical = canonicalUrl('/about')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: AboutPage,
})

const MILESTONES = [
  { year: '1996', title: 'Founded in Dubai', detail: 'Msheireb begins with a single twelve-home building on Jumeirah Beach Road.' },
  { year: '2004', title: 'Palm Jumeirah', detail: 'The practice delivers its first beachfront villas on the crescent.' },
  { year: '2013', title: 'Downtown', detail: 'A low-rise address around a shaded water court, minutes from Burj Khalifa.' },
  { year: '2027', title: 'Palm Crest', detail: 'Eighteen beachfront homes, the most detailed project we have built.' },
]

function AboutPage() {
  const [pageContent, setPageContent] = useState<{ title: string; content: string; sections: { header: string; description: string }[] } | null>(null)
  useEffect(() => {
    let active = true
    void requireSupabase().from('site_content').select('title,content').eq('slug', 'about').eq('published', true).maybeSingle().then(({ data }) => {
      if (active && data?.content) {
        let content = String(data.content)
        let sections: { header: string; description: string }[] = []
        try {
          const parsed = JSON.parse(content)
          if (parsed?.format === 'msheireb-about-sections-v1') {
            content = typeof parsed.intro === 'string' ? parsed.intro : ''
            sections = Array.isArray(parsed.sections) ? parsed.sections.filter((item: any) => item && typeof item.header === 'string' && typeof item.description === 'string') : []
          }
        } catch { /* Older plain-text About content is displayed as before. */ }
        setPageContent({ title: data.title, content, sections })
      }
    })
    return () => { active = false }
  }, [])
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="About"
          title={pageContent?.title || "Detail is the whole argument."}
          intro={pageContent ? 'Discover the people, vision and values behind Msheireb Properties.' : `Since 1996 Msheireb Properties has built slowly, in fewer places, with the people who live there in mind. Twelve landmark addresses across ${SITE.city}, and one standard.`}
          image={IMAGES.detail}
          imageAlt="Travertine wall with bronze fins and a palm shadow"
        />

        {!pageContent ? <>
        <section className="py-16 sm:py-24">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-12 lg:gap-16">
            <Reveal className="lg:col-span-7">
              <p className="eyebrow text-brass">The practice</p>
              <h2 className="display mt-5 text-[clamp(1.8rem,3vw,2.6rem)]">
                We build fewer homes, and finish them properly.
              </h2>
              <div className="mt-6 space-y-5 text-[1.02rem] leading-relaxed text-ink-soft">
                <p>
                  Travertine cut from a single quarry. Brass that patinas rather than fades. Windows
                  set deep enough to hold the desert light. Our specification is written before the
                  first drawing, and it does not change to suit a schedule.
                </p>
                <p>
                  Each address is designed around its site: the shade it receives, the wind off the
                  Gulf, the walk to the water. Amenity space is designed with the same care as the
                  residences, because the club is the quiet centre of the address.
                </p>
                <p>
                  Every Msheireb home is released in limited numbers, with private previews by
                  appointment. Our residential team stays with you from first viewing to handover,
                  and through the years that follow.
                </p>
              </div>

              <blockquote className="mt-10 border-l border-brass/60 pl-6">
                <p className="display text-[clamp(1.4rem,2.2vw,1.9rem)] italic leading-snug">
                  “A home should feel inevitable: as though the site, the light and the material were
                  always going to meet here.”
                </p>
                <footer className="eyebrow mt-4 text-[0.52rem] text-ink-soft">
                  The Msheireb design practice
                </footer>
              </blockquote>
            </Reveal>

            <Reveal className="lg:col-span-5" delay={120}>
              <img
                src={IMAGES.lowrise}
                alt="Low-rise limestone residence with planted balconies"
                className="aspect-[3/4] w-full object-cover"
                loading="lazy"
              />
              <dl className="mt-8 grid grid-cols-2 gap-6 border-t border-border pt-6">
                {[
                  { value: '3,400+', label: 'Homes delivered' },
                  { value: '4.8M', label: 'Sq. ft. developed' },
                  { value: '18', label: 'Design awards' },
                  { value: '1,200', label: 'Residents today' },
                ].map((stat) => (
                  <div key={stat.label}>
                    <dt className="eyebrow text-[0.5rem] text-ink-soft">{stat.label}</dt>
                    <dd className="display mt-2 text-2xl">{stat.value}</dd>
                  </div>
                ))}
              </dl>
            </Reveal>
          </div>
        </section>

        <section className="bg-deep py-16 text-on-deep sm:py-24">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8">
            <p className="eyebrow text-brass-soft">Milestones</p>
            <h2 className="display mt-5 max-w-xl text-[clamp(1.8rem,3vw,2.6rem)]">Thirty years, four markers.</h2>
            <ol className="mt-10 border-t border-on-deep/15">
              {MILESTONES.map((item) => (
                <li key={item.year}>
                  <Reveal
                    delay={60}
                    className="grid gap-3 border-b border-on-deep/15 py-6 sm:grid-cols-12 sm:gap-6"
                  >
                    <span className="eyebrow text-[0.6rem] text-brass sm:col-span-2">{item.year}</span>
                    <span className="display text-xl sm:col-span-4">{item.title}</span>
                    <span className="text-sm leading-relaxed text-on-deep/65 sm:col-span-6">{item.detail}</span>
                  </Reveal>
                </li>
              ))}
            </ol>

            <div className="mt-12 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/residences"
                className="eyebrow inline-flex items-center justify-between gap-8 bg-on-deep px-6 py-4 text-[0.6rem] text-deep transition-colors hover:bg-brass"
              >
                Explore residences
                <ArrowRight />
              </Link>
              <Link
                to="/contact"
                className="eyebrow inline-flex items-center justify-between gap-8 border border-on-deep/35 px-6 py-4 text-[0.6rem] text-on-deep transition-colors hover:border-brass hover:text-brass-soft"
              >
                Book a private preview
                <ArrowRight />
              </Link>
            </div>
          </div>
        </section>
        </> : <section className="py-16 sm:py-24"><div className="mx-auto grid w-full max-w-5xl gap-10 px-5 sm:px-8">{pageContent.content ? <div className="mx-auto w-full max-w-3xl whitespace-pre-wrap text-[1rem] leading-relaxed text-ink-soft">{pageContent.content}</div> : null}{pageContent.sections.length ? <div className="grid gap-5 sm:grid-cols-2">{pageContent.sections.map((item, index) => <article key={index} className="border border-border bg-card p-6 sm:p-8"><h2 className="display text-xl">{item.header}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-ink-soft">{item.description}</p></article>)}</div> : null}</div></section>}
      </main>
      <SiteFooter />
    </div>
  )
}
