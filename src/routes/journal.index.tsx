import { createFileRoute, Link } from '@tanstack/react-router'
import { PageIntro, SiteFooter, SiteHeader } from '../components/site-chrome'
import { IMAGES } from '../data/site'
import { canonicalUrl } from '../lib/canonical-url'
import siteMetadata from '../metadata.json'

const meta = siteMetadata['/journal']

export const Route = createFileRoute('/journal/')({
  head: () => {
    const canonical = canonicalUrl('/journal')
    return {
      meta: [
        { title: meta.title },
        { name: 'description', content: meta.description },
      ],
      links: canonical ? [{ rel: 'canonical', href: canonical }] : [],
    }
  },
  component: JournalPage,
})

function JournalPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main id="main">
        <PageIntro
          eyebrow="Journal"
          title="Notes on building, living and investing in Dubai."
          intro="Market letters, design notes and neighbourhood guides from the Msheireb editorial desk."
          image={IMAGES.detail}
          imageAlt="Travertine and bronze detail in afternoon light"
        />
        <section className="py-16 sm:py-24">
          <div className="mx-auto w-full max-w-4xl px-5 sm:px-8">
            <div className="border border-border bg-card px-6 py-14 text-center">
              <p className="eyebrow text-[0.55rem] text-brass">Coming soon</p>
              <h2 className="display mt-4 text-2xl sm:text-3xl">The first issue is being prepared.</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
                Our editorial articles will appear here when publishing is enabled.
              </p>
              <Link to="/contact" className="eyebrow mt-8 inline-flex items-center gap-3 bg-primary px-6 py-3.5 text-[0.55rem] text-primary-foreground">
                Talk to the team
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
